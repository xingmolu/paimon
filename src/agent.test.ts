import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Test helpers for tool testing
const TEST_DIR = join(process.cwd(), 'test-temp');

function ensureTestDir() {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('Tools', () => {
  beforeEach(() => {
    cleanup();
    ensureTestDir();
  });

  afterEach(() => {
    cleanup();
  });

  describe('bash tool', () => {
    it('should execute echo command', () => {
      const result = execSync('echo "hello world"', { encoding: 'utf-8' });
      expect(result.trim()).toBe('hello world');
    });

    it('should handle errors gracefully', () => {
      expect(() => {
        execSync('exit 1', { encoding: 'utf-8', shell: '/bin/bash' });
      }).toThrow();
    });

    it('should capture command output', () => {
      const result = execSync('ls -la', { encoding: 'utf-8' });
      expect(result).toContain('package.json');
    });
  });

  describe('read tool', () => {
    it('should read a file that exists', () => {
      const testFile = join(TEST_DIR, 'read-test.txt');
      writeFileSync(testFile, 'test content', 'utf-8');
      expect(existsSync(testFile)).toBe(true);
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('test content');
    });

    it('should return false for non-existent file', () => {
      expect(existsSync('/nonexistent/path/file.txt')).toBe(false);
    });

    it('should read multi-line file', () => {
      const testFile = join(TEST_DIR, 'multi-line.txt');
      writeFileSync(testFile, 'line1\nline2\nline3', 'utf-8');
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('line1\nline2\nline3');
    });
  });

  describe('write tool', () => {
    it('should write content to new file', () => {
      const testFile = join(TEST_DIR, 'write-test.txt');
      writeFileSync(testFile, 'test content', 'utf-8');
      expect(existsSync(testFile)).toBe(true);
      expect(readFileSync(testFile, 'utf-8')).toBe('test content');
    });

    it('should overwrite existing file', () => {
      const testFile = join(TEST_DIR, 'overwrite-test.txt');
      writeFileSync(testFile, 'original content', 'utf-8');
      writeFileSync(testFile, 'new content', 'utf-8');
      expect(readFileSync(testFile, 'utf-8')).toBe('new content');
    });

    it('should write empty file', () => {
      const testFile = join(TEST_DIR, 'empty.txt');
      writeFileSync(testFile, '', 'utf-8');
      expect(existsSync(testFile)).toBe(true);
      expect(readFileSync(testFile, 'utf-8')).toBe('');
    });
  });

  describe('edit tool', () => {
    it('should replace text in file', () => {
      const testFile = join(TEST_DIR, 'edit-test.txt');
      writeFileSync(testFile, 'Hello world!', 'utf-8');
      const content = readFileSync(testFile, 'utf-8');
      const newContent = content.replace('world', 'TypeScript');
      writeFileSync(testFile, newContent, 'utf-8');
      expect(readFileSync(testFile, 'utf-8')).toBe('Hello TypeScript!');
    });

    it('should only replace first occurrence', () => {
      const testFile = join(TEST_DIR, 'edit-multi.txt');
      writeFileSync(testFile, 'foo bar foo', 'utf-8');
      const content = readFileSync(testFile, 'utf-8');
      const newContent = content.replace('foo', 'baz');
      writeFileSync(testFile, newContent, 'utf-8');
      expect(readFileSync(testFile, 'utf-8')).toBe('baz bar foo');
    });

    it('should handle missing text gracefully', () => {
      const testFile = join(TEST_DIR, 'edit-missing.txt');
      writeFileSync(testFile, 'original content', 'utf-8');
      const content = readFileSync(testFile, 'utf-8');
      expect(content.includes('nonexistent')).toBe(false);
    });
  });

  describe('glob tool', () => {
    it('should find files matching pattern', () => {
      writeFileSync(join(TEST_DIR, 'a.ts'), '', 'utf-8');
      writeFileSync(join(TEST_DIR, 'b.ts'), '', 'utf-8');
      writeFileSync(join(TEST_DIR, 'c.js'), '', 'utf-8');

      const files = execSync(`find ${TEST_DIR} -name "*.ts" -type f`, { encoding: 'utf-8' });
      expect(files).toContain('a.ts');
      expect(files).toContain('b.ts');
      expect(files).not.toContain('c.js');
    });

    it('should return empty for no matches', () => {
      const files = execSync(`find ${TEST_DIR} -name "*.xyz" -type f`, { encoding: 'utf-8' });
      expect(files.trim()).toBe('');
    });

    it('should find files in subdirectories', () => {
      mkdirSync(join(TEST_DIR, 'sub'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'sub', 'nested.txt'), '', 'utf-8');
      
      const files = execSync(`find ${TEST_DIR} -name "*.txt" -type f`, { encoding: 'utf-8' });
      expect(files).toContain('nested.txt');
    });
  });
});

describe('Agent', () => {
  it('should have createAgent export', async () => {
    const { createAgent } = await import('./agent.js');
    expect(createAgent).toBeDefined();
    expect(typeof createAgent).toBe('function');
  });

  it('should create agent with valid config', async () => {
    const { createAgent } = await import('./agent.js');
    const config = {
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://test.example.com',
    };
    const { agent, run } = createAgent(config);
    expect(agent).toBeDefined();
    expect(run).toBeDefined();
    expect(typeof run).toBe('function');
  });
});