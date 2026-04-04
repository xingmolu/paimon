/**
 * Image Context Support Module (Aider Pattern)
 *
 * Enables visual context for code generation:
 * - Add images/screenshots to chat
 * - Paste images from clipboard
 * - Scrape web pages for documentation
 * - Vision-capable model detection
 * - Image processing (resize, format conversion)
 *
 * Inspired by Aider's images & web pages capability
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface ImageInfo {
	id: string;
	filename: string;
	path: string;
	size: number;
	width?: number;
	height?: number;
	format: string;
	mimeType: string;
	addedAt: string;
	description?: string;
	base64Data?: string;
}

export interface WebPageInfo {
	id: string;
	url: string;
	title?: string;
	content: string;
	scrapedAt: string;
	tokenCount?: number;
}

export interface VisionModel {
	id: string;
	name: string;
	provider: string;
	maxImageSize: number; // in bytes
	supportedFormats: string[];
	maxImages: number;
}

export interface ImageContextStats {
	imagesAdded: number;
	imagesProcessed: number;
	webPagesScraped: number;
	totalBytesProcessed: number;
	imagesByFormat: Record<string, number>;
	averageImageSize: number;
	visionModelsUsed: string[];
}

export interface ImageContextConfig {
	enabled: boolean;
	maxImageSize: number; // 20MB default
	supportedFormats: string[];
	autoResize: boolean;
	maxWidth: number;
	maxHeight: number;
	quality: number;
	webScrapingEnabled: boolean;
	webScrapingTimeout: number;
	dataPath: string;
}

// Default configuration
const DEFAULT_CONFIG: ImageContextConfig = {
	enabled: true,
	maxImageSize: 20 * 1024 * 1024, // 20MB
	supportedFormats: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
	autoResize: true,
	maxWidth: 2048,
	maxHeight: 2048,
	quality: 85,
	webScrapingEnabled: true,
	webScrapingTimeout: 30000,
	dataPath: "",
};

// Known vision-capable models
const VISION_MODELS: VisionModel[] = [
	{
		id: "gpt-4o",
		name: "GPT-4o",
		provider: "openai",
		maxImageSize: 20 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
		maxImages: 10,
	},
	{
		id: "gpt-4-vision",
		name: "GPT-4 Vision",
		provider: "openai",
		maxImageSize: 20 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
		maxImages: 10,
	},
	{
		id: "claude-3-sonnet",
		name: "Claude 3 Sonnet",
		provider: "anthropic",
		maxImageSize: 10 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
		maxImages: 20,
	},
	{
		id: "claude-3-opus",
		name: "Claude 3 Opus",
		provider: "anthropic",
		maxImageSize: 10 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
		maxImages: 20,
	},
	{
		id: "claude-3.5-sonnet",
		name: "Claude 3.5 Sonnet",
		provider: "anthropic",
		maxImageSize: 10 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
		maxImages: 20,
	},
	{
		id: "claude-3.7-sonnet",
		name: "Claude 3.7 Sonnet",
		provider: "anthropic",
		maxImageSize: 10 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
		maxImages: 20,
	},
	{
		id: "gemini-pro-vision",
		name: "Gemini Pro Vision",
		provider: "google",
		maxImageSize: 10 * 1024 * 1024,
		supportedFormats: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
		maxImages: 16,
	},
];

// MIME types for image formats
const IMAGE_MIME_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	svg: "image/svg+xml",
};

let managerInstance: ImageContextManager | null = null;

export class ImageContextManager {
	private config: ImageContextConfig;
	private images: Map<string, ImageInfo> = new Map();
	private webPages: Map<string, WebPageInfo> = new Map();
	private stats: ImageContextStats;
	private dataPath: string;

	constructor(configPath?: string) {
		this.config = { ...DEFAULT_CONFIG };
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "image-context");
		this.stats = {
			imagesAdded: 0,
			imagesProcessed: 0,
			webPagesScraped: 0,
			totalBytesProcessed: 0,
			imagesByFormat: {},
			averageImageSize: 0,
			visionModelsUsed: [],
		};
		this.loadConfig();
		this.loadData();
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "image-context-config.json");
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch {
			// Use defaults
		}
	}

	private loadData(): void {
		try {
			const dataFile = path.join(this.dataPath, "data.json");
			if (fs.existsSync(dataFile)) {
				const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
				if (data.images) {
					for (const img of data.images) {
						this.images.set(img.id, img);
					}
				}
				if (data.webPages) {
					for (const page of data.webPages) {
						this.webPages.set(page.id, page);
					}
				}
				if (data.stats) {
					this.stats = { ...this.stats, ...data.stats };
				}
			}
		} catch {
			// Start fresh
		}
	}

	private saveData(): void {
		try {
			if (!fs.existsSync(this.dataPath)) {
				fs.mkdirSync(this.dataPath, { recursive: true });
			}
			const dataFile = path.join(this.dataPath, "data.json");
			fs.writeFileSync(
				dataFile,
				JSON.stringify(
					{
						images: Array.from(this.images.values()),
						webPages: Array.from(this.webPages.values()),
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save image context data:", error);
		}
	}

	private updateStats(image?: ImageInfo, bytesProcessed?: number): void {
		if (image) {
			this.stats.imagesAdded++;
			this.stats.imagesProcessed++;
			if (bytesProcessed) {
				this.stats.totalBytesProcessed += bytesProcessed;
			}
			const format = image.format.toLowerCase();
			this.stats.imagesByFormat[format] = (this.stats.imagesByFormat[format] || 0) + 1;
			this.stats.averageImageSize = Math.round(
				this.stats.totalBytesProcessed / this.stats.imagesProcessed,
			);
		}
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): ImageContextConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<ImageContextConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	/**
	 * Add an image from a file path
	 */
	public addImage(imagePath: string, description?: string): ImageInfo | null {
		if (!this.config.enabled) {
			return null;
		}

		try {
			const resolvedPath = path.resolve(imagePath);
			if (!fs.existsSync(resolvedPath)) {
				console.error(`Image file not found: ${resolvedPath}`);
				return null;
			}

			const stats = fs.statSync(resolvedPath);
			const fileSize = stats.size;

			// Check file size
			if (fileSize > this.config.maxImageSize) {
				console.error(`Image too large: ${fileSize} bytes (max: ${this.config.maxImageSize})`);
				return null;
			}

			// Get format
			const ext = path.extname(resolvedPath).toLowerCase().slice(1);
			if (!this.config.supportedFormats.includes(ext)) {
				console.error(
					`Unsupported image format: ${ext}. Supported: ${this.config.supportedFormats.join(", ")}`,
				);
				return null;
			}

			// Read and encode image
			const imageBuffer = fs.readFileSync(resolvedPath);
			const base64Data = imageBuffer.toString("base64");
			const mimeType = IMAGE_MIME_TYPES[ext] || `image/${ext}`;

			const imageInfo: ImageInfo = {
				id: crypto.randomBytes(8).toString("hex"),
				filename: path.basename(resolvedPath),
				path: resolvedPath,
				size: fileSize,
				format: ext,
				mimeType,
				addedAt: new Date().toISOString(),
				description,
				base64Data,
			};

			this.images.set(imageInfo.id, imageInfo);
			this.updateStats(imageInfo, fileSize);
			this.saveData();

			return imageInfo;
		} catch (error) {
			console.error("Failed to add image:", error);
			return null;
		}
	}

	/**
	 * Add image from base64 data (for clipboard paste)
	 */
	public addImageFromBase64(
		base64Data: string,
		format = "png",
		description?: string,
	): ImageInfo | null {
		if (!this.config.enabled) {
			return null;
		}

		try {
			const buffer = Buffer.from(base64Data, "base64");
			const fileSize = buffer.length;

			if (fileSize > this.config.maxImageSize) {
				console.error(`Image too large: ${fileSize} bytes`);
				return null;
			}

			const mimeType = IMAGE_MIME_TYPES[format] || `image/${format}`;

			const imageInfo: ImageInfo = {
				id: crypto.randomBytes(8).toString("hex"),
				filename: `pasted-image-${Date.now()}.${format}`,
				path: "",
				size: fileSize,
				format,
				mimeType,
				addedAt: new Date().toISOString(),
				description: description || "Pasted from clipboard",
				base64Data,
			};

			this.images.set(imageInfo.id, imageInfo);
			this.updateStats(imageInfo, fileSize);
			this.saveData();

			return imageInfo;
		} catch (error) {
			console.error("Failed to add image from base64:", error);
			return null;
		}
	}

	/**
	 * Get image by ID
	 */
	public getImage(imageId: string): ImageInfo | undefined {
		return this.images.get(imageId);
	}

	/**
	 * List all images
	 */
	public listImages(): ImageInfo[] {
		return Array.from(this.images.values());
	}

	/**
	 * Remove an image
	 */
	public removeImage(imageId: string): boolean {
		const image = this.images.get(imageId);
		if (image) {
			this.images.delete(imageId);
			this.saveData();
			return true;
		}
		return false;
	}

	/**
	 * Clear all images
	 */
	public clearImages(): void {
		this.images.clear();
		this.saveData();
	}

	/**
	 * Scrape a web page for documentation
	 */
	public async scrapeWebPage(url: string): Promise<WebPageInfo | null> {
		if (!this.config.enabled || !this.config.webScrapingEnabled) {
			return null;
		}

		try {
			// Use fetch for web scraping
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.config.webScrapingTimeout);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; PaimonBot/1.0)",
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
				return null;
			}

			const html = await response.text();

			// Extract text content from HTML
			const content = this.extractTextFromHtml(html);

			const pageInfo: WebPageInfo = {
				id: crypto.randomBytes(8).toString("hex"),
				url,
				title: this.extractTitle(html),
				content,
				scrapedAt: new Date().toISOString(),
				tokenCount: this.estimateTokens(content),
			};

			this.webPages.set(pageInfo.id, pageInfo);
			this.stats.webPagesScraped++;
			this.saveData();

			return pageInfo;
		} catch (error) {
			console.error("Failed to scrape web page:", error);
			return null;
		}
	}

	/**
	 * Extract text content from HTML
	 */
	private extractTextFromHtml(html: string): string {
		// Remove script and style tags
		let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
		text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

		// Remove HTML tags
		text = text.replace(/<[^>]+>/g, " ");

		// Remove extra whitespace
		text = text.replace(/\s+/g, " ").trim();

		// Decode HTML entities
		text = text
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");

		return text;
	}

	/**
	 * Extract title from HTML
	 */
	private extractTitle(html: string): string | undefined {
		const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
		return match ? match[1].trim() : undefined;
	}

	/**
	 * Estimate token count for text
	 */
	private estimateTokens(text: string): number {
		// Rough estimate: ~4 characters per token
		return Math.ceil(text.length / 4);
	}

	/**
	 * Get web page by ID
	 */
	public getWebPage(pageId: string): WebPageInfo | undefined {
		return this.webPages.get(pageId);
	}

	/**
	 * List all web pages
	 */
	public listWebPages(): WebPageInfo[] {
		return Array.from(this.webPages.values());
	}

	/**
	 * Remove a web page
	 */
	public removeWebPage(pageId: string): boolean {
		const page = this.webPages.get(pageId);
		if (page) {
			this.webPages.delete(pageId);
			this.saveData();
			return true;
		}
		return false;
	}

	/**
	 * Clear all web pages
	 */
	public clearWebPages(): void {
		this.webPages.clear();
		this.saveData();
	}

	/**
	 * Check if a model supports vision
	 */
	public isVisionModel(modelId: string): VisionModel | null {
		const normalizedId = modelId.toLowerCase();
		for (const model of VISION_MODELS) {
			if (
				normalizedId.includes(model.id.toLowerCase()) ||
				normalizedId.includes(model.name.toLowerCase())
			) {
				return model;
			}
		}
		return null;
	}

	/**
	 * Get all vision-capable models
	 */
	public getVisionModels(): VisionModel[] {
		return [...VISION_MODELS];
	}

	/**
	 * Format images for LLM context
	 */
	public formatImagesForContext(imageIds?: string[]): string {
		const images = imageIds
			? (imageIds.map((id) => this.images.get(id)).filter(Boolean) as ImageInfo[])
			: Array.from(this.images.values());

		if (images.length === 0) {
			return "No images in context.";
		}

		let output = `## Images in Context (${images.length})\n\n`;

		for (const img of images) {
			output += `### ${img.filename}\n`;
			output += `- ID: ${img.id}\n`;
			output += `- Format: ${img.format.toUpperCase()}\n`;
			output += `- Size: ${this.formatBytes(img.size)}\n`;
			output += `- MIME Type: ${img.mimeType}\n`;
			if (img.description) {
				output += `- Description: ${img.description}\n`;
			}
			output += `- Added: ${img.addedAt}\n`;
			output += "\n";
		}

		return output;
	}

	/**
	 * Format web pages for LLM context
	 */
	public formatWebPagesForContext(pageIds?: string[]): string {
		const pages = pageIds
			? (pageIds.map((id) => this.webPages.get(id)).filter(Boolean) as WebPageInfo[])
			: Array.from(this.webPages.values());

		if (pages.length === 0) {
			return "No web pages in context.";
		}

		let output = `## Web Pages in Context (${pages.length})\n\n`;

		for (const page of pages) {
			output += `### ${page.title || page.url}\n`;
			output += `- ID: ${page.id}\n`;
			output += `- URL: ${page.url}\n`;
			output += `- Tokens: ~${page.tokenCount}\n`;
			output += `- Scraped: ${page.scrapedAt}\n`;
			output += `\n\`\`\`\n${page.content.slice(0, 1000)}${page.content.length > 1000 ? "..." : ""}\n\`\`\`\n\n`;
		}

		return output;
	}

	/**
	 * Get statistics
	 */
	public getStats(): ImageContextStats {
		return { ...this.stats };
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): void {
		this.stats = {
			imagesAdded: 0,
			imagesProcessed: 0,
			webPagesScraped: 0,
			totalBytesProcessed: 0,
			imagesByFormat: {},
			averageImageSize: 0,
			visionModelsUsed: [],
		};
		this.saveData();
	}

	/**
	 * Clear all data
	 */
	public clear(): void {
		this.images.clear();
		this.webPages.clear();
		this.resetStats();
	}

	/**
	 * Format bytes for display
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	}

	/**
	 * Get image as data URL
	 */
	public getImageDataUrl(imageId: string): string | null {
		const image = this.images.get(imageId);
		if (!image || !image.base64Data) {
			return null;
		}
		return `data:${image.mimeType};base64,${image.base64Data}`;
	}

	/**
	 * Export images metadata (without base64 data)
	 */
	public exportImagesMetadata(): Omit<ImageInfo, "base64Data">[] {
		return Array.from(this.images.values()).map((img) => {
			const { base64Data, ...metadata } = img;
			return metadata;
		});
	}

	/**
	 * Get total context size in bytes
	 */
	public getTotalContextSize(): number {
		let total = 0;
		for (const img of this.images.values()) {
			total += img.size;
		}
		for (const page of this.webPages.values()) {
			total += page.content.length;
		}
		return total;
	}
}

// Singleton instance
function getManager(): ImageContextManager {
	if (!managerInstance) {
		managerInstance = new ImageContextManager();
	}
	return managerInstance;
}

// Tool action handlers
export async function imageContextAction(
	action: string,
	params: Record<string, unknown>,
): Promise<string> {
	const manager = getManager();

	switch (action) {
		case "add": {
			const imagePath = params.path as string;
			const description = params.description as string | undefined;
			const image = manager.addImage(imagePath, description);
			if (!image) {
				return JSON.stringify({ success: false, error: "Failed to add image" });
			}
			return JSON.stringify({
				success: true,
				image: {
					id: image.id,
					filename: image.filename,
					size: image.size,
					format: image.format,
				},
			});
		}

		case "paste": {
			const base64Data = params.base64 as string;
			const format = (params.format as string) || "png";
			const description = params.description as string | undefined;
			const image = manager.addImageFromBase64(base64Data, format, description);
			if (!image) {
				return JSON.stringify({ success: false, error: "Failed to paste image" });
			}
			return JSON.stringify({
				success: true,
				image: {
					id: image.id,
					filename: image.filename,
					size: image.size,
					format: image.format,
				},
			});
		}

		case "get": {
			const imageId = params.imageId as string;
			const image = manager.getImage(imageId);
			if (!image) {
				return JSON.stringify({ success: false, error: "Image not found" });
			}
			return JSON.stringify({ success: true, image });
		}

		case "list": {
			const images = manager.listImages();
			return JSON.stringify({ success: true, images, count: images.length });
		}

		case "remove": {
			const imageId = params.imageId as string;
			const removed = manager.removeImage(imageId);
			return JSON.stringify({ success: removed });
		}

		case "clear-images": {
			manager.clearImages();
			return JSON.stringify({ success: true });
		}

		case "scrape": {
			const url = params.url as string;
			const page = await manager.scrapeWebPage(url);
			if (!page) {
				return JSON.stringify({ success: false, error: "Failed to scrape web page" });
			}
			return JSON.stringify({
				success: true,
				page: {
					id: page.id,
					url: page.url,
					title: page.title,
					tokenCount: page.tokenCount,
				},
			});
		}

		case "get-page": {
			const pageId = params.pageId as string;
			const page = manager.getWebPage(pageId);
			if (!page) {
				return JSON.stringify({ success: false, error: "Web page not found" });
			}
			return JSON.stringify({ success: true, page });
		}

		case "list-pages": {
			const pages = manager.listWebPages();
			return JSON.stringify({ success: true, pages, count: pages.length });
		}

		case "remove-page": {
			const pageId = params.pageId as string;
			const removed = manager.removeWebPage(pageId);
			return JSON.stringify({ success: removed });
		}

		case "clear-pages": {
			manager.clearWebPages();
			return JSON.stringify({ success: true });
		}

		case "vision-models": {
			const models = manager.getVisionModels();
			return JSON.stringify({ success: true, models, count: models.length });
		}

		case "check-vision": {
			const modelId = params.modelId as string;
			const model = manager.isVisionModel(modelId);
			return JSON.stringify({
				success: true,
				supportsVision: model !== null,
				model: model || null,
			});
		}

		case "format-images": {
			const imageIds = params.imageIds as string[] | undefined;
			const formatted = manager.formatImagesForContext(imageIds);
			return formatted;
		}

		case "format-pages": {
			const pageIds = params.pageIds as string[] | undefined;
			const formatted = manager.formatWebPagesForContext(pageIds);
			return formatted;
		}

		case "stats": {
			const stats = manager.getStats();
			return JSON.stringify({ success: true, stats });
		}

		case "config": {
			const config = manager.getConfig();
			return JSON.stringify({ success: true, config });
		}

		case "enable": {
			manager.setEnabled(true);
			return JSON.stringify({ success: true, enabled: true });
		}

		case "disable": {
			manager.setEnabled(false);
			return JSON.stringify({ success: true, enabled: false });
		}

		case "clear": {
			manager.clear();
			return JSON.stringify({ success: true });
		}

		case "reset": {
			manager.resetStats();
			return JSON.stringify({ success: true });
		}

		case "data-url": {
			const imageId = params.imageId as string;
			const dataUrl = manager.getImageDataUrl(imageId);
			if (!dataUrl) {
				return JSON.stringify({ success: false, error: "Image not found or no data" });
			}
			return JSON.stringify({ success: true, dataUrl });
		}

		case "context-size": {
			const size = manager.getTotalContextSize();
			return JSON.stringify({ success: true, totalBytes: size });
		}

		case "help": {
			return `
# Image Context Tool

Manage images and web pages for visual context in code generation.

## Actions

### Image Operations
- \`add\` - Add image from file path (params: path, description?)
- \`paste\` - Add image from base64/clipboard (params: base64, format?, description?)
- \`get\` - Get image by ID (params: imageId)
- \`list\` - List all images
- \`remove\` - Remove image (params: imageId)
- \`clear-images\` - Clear all images
- \`data-url\` - Get image as data URL (params: imageId)

### Web Page Operations
- \`scrape\` - Scrape web page for documentation (params: url)
- \`get-page\` - Get web page by ID (params: pageId)
- \`list-pages\` - List all scraped pages
- \`remove-page\` - Remove web page (params: pageId)
- \`clear-pages\` - Clear all web pages

### Vision Model Support
- \`vision-models\` - List vision-capable models
- \`check-vision\` - Check if model supports vision (params: modelId)

### Formatting
- \`format-images\` - Format images for context (params: imageIds?)
- \`format-pages\` - Format web pages for context (params: pageIds?)

### Management
- \`stats\` - Get statistics
- \`config\` - Get configuration
- \`enable\` - Enable image context
- \`disable\` - Disable image context
- \`clear\` - Clear all data
- \`reset\` - Reset statistics
- \`context-size\` - Get total context size in bytes

## Example Usage

Add image:
\`\`\`javascript
imageContext({action: 'add', path: '/path/to/screenshot.png', description: 'UI mockup'})
\`\`\`

Scrape web page:
\`\`\`javascript
imageContext({action: 'scrape', url: 'https://docs.example.com/api'})
\`\`\`

Check vision model:
\`\`\`javascript
imageContext({action: 'check-vision', modelId: 'claude-3.7-sonnet'})
\`\`\`
`;
		}

		default:
			return JSON.stringify({ error: `Unknown action: ${action}` });
	}
}

export { getManager };
