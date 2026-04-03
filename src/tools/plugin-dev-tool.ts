/**
 * Plugin Development Tool (Claude Code Pattern)
 * 
 * Tool for managing plugin development workflow with 8 phases
 * and 7 specialized skills for hooks, MCP, commands, agents, and more.
 */

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import { Type } from '@sinclair/typebox';
import { PluginDevManager } from '../plugin-dev.js';
import type {
  PluginDevPhase,
  PluginSkillType,
  PluginAgentType,
  PluginComponentSpec,
} from '../plugin-dev.js';

let managerInstance: PluginDevManager | null = null;

function getManager(): PluginDevManager {
  if (!managerInstance) {
    managerInstance = new PluginDevManager();
  }
  return managerInstance;
}

// Phase order for guidance action
const PHASE_ORDER: PluginDevPhase[] = [
  'discovery',
  'component-planning',
  'detailed-design',
  'structure-creation',
  'component-implementation',
  'validation',
  'testing',
  'documentation'
];

function formatHelp(): string {
  return `
## Plugin Development Toolkit (Claude Code Pattern)

8-Phase Workflow for creating plugins:
1. Discovery - Understand plugin purpose and requirements
2. Component Planning - Determine needed skills, commands, agents, hooks, MCP
3. Detailed Design - Specify each component and resolve ambiguities  
4. Structure Creation - Set up directories and manifest
5. Component Implementation - Create each component using AI-assisted agents
6. Validation - Run plugin-validator and component-specific checks
7. Testing - Verify plugin works in environment
8. Documentation - Finalize README and prepare for distribution

### 7 Specialized Skills:
- hook-dev: Advanced hooks API and event-driven automation
- mcp-integration: Model Context Protocol server integration
- plugin-structure: Plugin organization and manifest configuration
- plugin-settings: Configuration patterns using .local.md files
- command-dev: Creating slash commands with frontmatter
- agent-dev: Creating autonomous agents with AI-assisted generation
- skill-dev: Creating skills with progressive disclosure

### 3 Agents:
- plugin-validator: Validate plugin structure and components
- agent-creator: Generate agent definitions from requirements
- skill-reviewer: Review skill definitions for best practices

### Actions:
- start: Start a new plugin development session
- phase: Set current phase
- progress: Move to next phase
- status: Check session status
- sessions: List all sessions
- skills: List all plugin development skills
- skill: Get specific skill details
- agents: List all plugin development agents
- agent: Get specific agent details
- guidance: Get phase guidance
- stats: View statistics
- config: View configuration
- help: Get help message

### Quick Start:
1. pluginDev({action: 'start', description: 'Your plugin description'})
2. pluginDev({action: 'progress'}) - Move through phases
3. pluginDev({action: 'status'}) - Check current progress
`;
}

function formatPhaseGuidance(phase: PluginDevPhase, mgr: PluginDevManager): string {
  const guidance = mgr.getPhaseGuidance(phase);
  return `
## ${phase.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}

**Purpose:** ${guidance.purpose}

**Actions:**
${guidance.actions.map(a => `- ${a}`).join('\n')}
`;
}

function formatSessionStatus(session: ReturnType<PluginDevManager['getSession']>): string {
  if (!session) return 'No active session';
  
  return `
## Plugin Development Session

**Session ID:** ${session.id}
**Description:** ${session.description}
**Current Phase:** ${session.currentPhase}
**Created:** ${session.created}
**Complete:** ${session.complete ? 'Yes' : 'No'}

### Components (${session.components.length}):
${session.components.map(c => `- ${c.type}: ${c.name} (${c.enabled ? 'enabled' : 'disabled'})`).join('\n') || 'None'}

### Skills Required: ${session.requiredSkills.join(', ')}
### Agents Used: ${session.agentsUsed.join(', ') || 'None'}
`;
}

function formatSkills(skills: ReturnType<PluginDevManager['getAllSkills']>): string {
  return `
## Plugin Development Skills (${skills.length})

${skills.map(s => `
### ${s.name} (${s.type})
**Description:** ${s.description}
**Trigger Phrases:** ${s.triggerPhrases.slice(0, 3).join(', ')}
**Core Topics:** ${s.coreTopics.slice(0, 3).join(', ')}
**Resources:** ${s.resources.examples} examples, ${s.resources.references} references, ${s.resources.scripts} scripts
`).join('\n')}
`;
}

function formatAgents(agents: ReturnType<PluginDevManager['getAllAgents']>): string {
  return `
## Plugin Development Agents (${agents.length})

${agents.map(a => `
### ${a.name} (${a.type})
**Description:** ${a.description}
**Purpose:** ${a.purpose}
**Inputs:** ${a.inputs.join(', ')}
**Outputs:** ${a.outputs.join(', ')}
`).join('\n')}
`;
}

function formatStats(stats: ReturnType<PluginDevManager['getStats']>): string {
  return `
## Plugin Development Statistics

**Sessions:** ${stats.sessionsCreated} created, ${stats.sessionsCompleted} completed
**Average Time:** ${stats.averageTimeMinutes.toFixed(1)} minutes
**Validation Pass Rate:** ${(stats.validationPassRate * 100).toFixed(1)}%

### Phases Completed:
${Object.entries(stats.phasesCompleted).map(([p, c]) => `- ${p}: ${c}`).join('\n')}

### Components Created:
${Object.entries(stats.componentsCreated).map(([t, c]) => `- ${t}: ${c}`).join('\n')}

### Skills Used:
${Object.entries(stats.skillsUsed).map(([s, c]) => `- ${s}: ${c}`).join('\n')}

### Agents Used:
${Object.entries(stats.agentsUsed).map(([a, c]) => `- ${a}: ${c}`).join('\n')}
`;
}

/**
 * Plugin Dev tool - 8-phase plugin development workflow
 */
export const pluginDevTool: AgentTool = {
  name: 'pluginDev',
  label: 'Plugin Development Toolkit',
  description: 'Manage the Plugin Development Toolkit with 8-phase workflow for creating plugins (Claude Code Pattern)',
  parameters: Type.Object({
    action: Type.String({
      description: 'Action: start, phase, progress, status, sessions, skills, skill, agents, agent, guidance, stats, config, reset, clear, help'
    }),
    description: Type.Optional(Type.String({ description: 'Plugin description (for start action)' })),
    sessionId: Type.Optional(Type.String({ description: 'Session ID for session operations' })),
    phase: Type.Optional(Type.String({ description: 'Phase name for phase/guidance actions' })),
    notes: Type.Optional(Type.Array(Type.String(), { description: 'Notes to add to phase' })),
    skillType: Type.Optional(Type.String({ description: 'Skill type for skill action' })),
    agentType: Type.Optional(Type.String({ description: 'Agent type for agent action' })),
    component: Type.Optional(Type.Object({
      type: Type.String({ description: 'Component type: command, agent, skill, hook, mcp' }),
      name: Type.String({ description: 'Component name' }),
      description: Type.String({ description: 'Component description' }),
      enabled: Type.Optional(Type.Boolean({ description: 'Is component enabled' })),
      validated: Type.Optional(Type.Boolean({ description: 'Is component validated' })),
      tested: Type.Optional(Type.Boolean({ description: 'Is component tested' }))
    })),
    componentName: Type.Optional(Type.String({ description: 'Component name for update action' })),
    pluginName: Type.Optional(Type.String({ description: 'Plugin name for structure action' })),
    pluginDirectory: Type.Optional(Type.String({ description: 'Plugin directory for structure action' })),
    passed: Type.Optional(Type.Boolean({ description: 'Whether validation/testing passed' })),
    errors: Type.Optional(Type.Array(Type.String(), { description: 'Validation errors' })),
    warnings: Type.Optional(Type.Array(Type.String(), { description: 'Validation warnings' })),
    results: Type.Optional(Type.Array(Type.String(), { description: 'Testing results' })),
    reason: Type.Optional(Type.String({ description: 'Reason for cancel' })),
    filter: Type.Optional(Type.String({ description: 'Filter for sessions: active, complete, all' })),
    keepCount: Type.Optional(Type.Number({ description: 'Number of sessions to keep when clearing' })),
    limit: Type.Optional(Type.Number({ description: 'Limit for sessions list' }))
  }),
  execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
    const mgr = getManager();
    const args = params as Record<string, unknown>;
    const action = args.action as string;

    if (!action) {
      return { content: [{ type: 'text', text: formatHelp() }], details: { action: 'help' } };
    }

    let result: string;

    switch (action) {
      case 'start': {
        const description = args.description as string;
        if (!description) {
          result = 'Error: description required for start action';
          break;
        }
        const session = mgr.createSession(description);
        const guidance = mgr.getPhaseGuidance(session.currentPhase);
        result = `
## Plugin Development Session Started

**Session ID:** ${session.id}
**Description:** ${session.description}
**Current Phase:** ${session.currentPhase}

${formatPhaseGuidance(session.currentPhase, mgr)}
`;
        break;
      }

      case 'phase': {
        const sessionId = args.sessionId as string | undefined;
        const targetPhase = args.phase as PluginDevPhase | undefined;
        
        if (!targetPhase) {
          const activeSessions = mgr.listSessions('active');
          if (activeSessions.length === 0) {
            result = 'No active session. Use start action first.';
            break;
          }
          const session = activeSessions[activeSessions.length - 1];
          result = formatPhaseGuidance(session.currentPhase, mgr);
          break;
        }
        
        if (!sessionId) {
          result = formatPhaseGuidance(targetPhase, mgr);
          break;
        }
        
        const session = mgr.setPhase(sessionId, targetPhase);
        if (!session) {
          result = `Error: Session ${sessionId} not found`;
          break;
        }
        result = formatPhaseGuidance(targetPhase, mgr);
        break;
      }

      case 'progress': {
        const sessionId = args.sessionId as string | undefined;
        const notes = args.notes as string[] | undefined;
        
        if (!sessionId) {
          const activeSessions = mgr.listSessions('active');
          if (activeSessions.length === 0) {
            result = 'Error: No active session. Use start action first.';
            break;
          }
          const latestSession = activeSessions[activeSessions.length - 1];
          const progressResult = mgr.progressPhase(latestSession.id, notes);
          if (!progressResult) {
            result = 'Error: Cannot progress - no more phases';
            break;
          }
          result = `
## Progressed to ${progressResult.currentPhase}

${formatPhaseGuidance(progressResult.currentPhase, mgr)}
`;
          break;
        }
        
        const progressSession = mgr.progressPhase(sessionId, notes);
        if (!progressSession) {
          result = `Error: Session ${sessionId} not found or cannot progress`;
          break;
        }
        result = `
## Progressed to ${progressSession.currentPhase}

${formatPhaseGuidance(progressSession.currentPhase, mgr)}
`;
        break;
      }

      case 'status': {
        const sessionId = args.sessionId as string | undefined;
        if (!sessionId) {
          const activeSessions = mgr.listSessions('active');
          if (activeSessions.length === 0) {
            result = 'No active session. Use start action first.';
            break;
          }
          const session = activeSessions[activeSessions.length - 1];
          result = formatSessionStatus(session);
          break;
        }
        const session = mgr.getSession(sessionId);
        result = formatSessionStatus(session);
        break;
      }

      case 'sessions': {
        const filter = args.filter as 'active' | 'complete' | 'all' | undefined;
        const limit = args.limit as number | undefined;
        const sessions = mgr.listSessions(filter || 'all');
        const limitedSessions = limit ? sessions.slice(0, limit) : sessions;
        result = `
## Plugin Development Sessions (${limitedSessions.length})

${limitedSessions.map(s => `- **${s.id}**: ${s.description} (${s.currentPhase}) ${s.complete ? '✅' : '🔄'}`).join('\n') || 'None'}
`;
        break;
      }

      case 'skills': {
        result = formatSkills(mgr.getAllSkills());
        break;
      }

      case 'skill': {
        const skillType = args.skillType as PluginSkillType;
        if (!skillType) {
          result = 'Error: skillType required for skill action';
          break;
        }
        const skill = mgr.getSkill(skillType);
        if (!skill) {
          result = `Error: Skill ${skillType} not found`;
          break;
        }
        result = `
## ${skill.name} (${skill.type})

**Description:** ${skill.description}

**Trigger Phrases:**
${skill.triggerPhrases.map(p => `- ${p}`).join('\n')}

**Core Topics:**
${skill.coreTopics.map(t => `- ${t}`).join('\n')}

**Resources:** ${skill.resources.examples} examples, ${skill.resources.references} references, ${skill.resources.scripts} scripts
`;
        break;
      }

      case 'agents': {
        result = formatAgents(mgr.getAllAgents());
        break;
      }

      case 'agent': {
        const agentType = args.agentType as PluginAgentType;
        if (!agentType) {
          result = 'Error: agentType required for agent action';
          break;
        }
        const agent = mgr.getAgent(agentType);
        if (!agent) {
          result = `Error: Agent ${agentType} not found`;
          break;
        }
        result = `
## ${agent.name} (${agent.type})

**Description:** ${agent.description}
**Purpose:** ${agent.purpose}

**Inputs:**
${agent.inputs.map(i => `- ${i}`).join('\n')}

**Outputs:**
${agent.outputs.map(o => `- ${o}`).join('\n')}
`;
        break;
      }

      case 'guidance': {
        const phase = args.phase as PluginDevPhase | undefined;
        if (!phase) {
          result = `
## All Phase Guidance

${PHASE_ORDER.map(p => formatPhaseGuidance(p, mgr)).join('\n')}
`;
          break;
        }
        result = formatPhaseGuidance(phase, mgr);
        break;
      }

      case 'stats': {
        result = formatStats(mgr.getStats());
        break;
      }

      case 'config': {
        result = `
## Plugin Development Configuration

- Data Directory: ~/.paimon/plugin-dev
- Auto Phase: false
- Default Skills: hook-dev, mcp-integration, plugin-structure, command-dev, agent-dev, skill-dev
- Validation Enabled: true
`;
        break;
      }

      case 'reset': {
        mgr.resetStats();
        result = 'Statistics reset successfully';
        break;
      }

      case 'clear': {
        const keepCount = args.keepCount as number | undefined;
        mgr.clearOldSessions(keepCount);
        result = keepCount ? `Old sessions cleared, kept ${keepCount}` : 'All sessions cleared';
        break;
      }

      case 'help': {
        result = formatHelp();
        break;
      }

      default: {
        result = `Unknown action: ${action}. Use 'help' for available actions.`;
      }
    }

    return { content: [{ type: 'text', text: result }], details: { action } };
  }
};
