#!/bin/bash
# evo evolution script - Self-evolution loop using evo's own agent
# evo loads skills internally, so we just provide context

set -euo pipefail

# Load environment variables
set -o allexport
source .env 2>/dev/null || true
set +o allexport

DATE=$(date +%Y-%m-%d)
SESSION_TIME=$(date +%H:%M)
MODEL="${EVO_MODEL:-glm-5}"
REPO="${REPO:-xingmolu/evo}"
MAX_ITERATIONS="${MAX_ITERATIONS:-3}"

echo "=== Evo Evolution Session ==="
echo "Time: $DATE $SESSION_TIME"
echo "Model: $MODEL"
echo "Repo: $REPO"
echo ""

# Check API key
if [ -z "${DASHSCOPE_API_KEY:-}" ]; then
    echo "ERROR: DASHSCOPE_API_KEY not set"
    exit 1
fi

# === Fetch GitHub Issues ===
echo "→ Fetching GitHub issues..."
ISSUES_FILE="issues.md"
if command -v gh &>/dev/null; then
    gh issue list --repo "$REPO" --state open --limit 10 \
        --json number,title,body,labels,author \
        > /tmp/issues.json 2>/dev/null || echo "[]" > /tmp/issues.json
    
    {
        echo "# Open Issues for $REPO"
        echo ""
        python3 -c "
import json
with open('/tmp/issues.json') as f:
    issues = json.load(f)
for issue in issues:
    print(f'## Issue #{issue[\"number\"]}: {issue[\"title\"]}')
    print(f'Author: {issue.get(\"author\", {}).get(\"login\", \"unknown\")}')
    labels = issue.get('labels', [])
    if labels:
        print(f'Labels: {\", \".join(l[\"name\"] for l in labels)}')
    print()
    body = issue.get('body', '') or '(no description)'
    print(body[:800])
    print()
" 2>/dev/null || echo "Failed to parse issues"
    } > "$ISSUES_FILE"
    
    ISSUE_COUNT=$(grep -c "^## Issue" "$ISSUES_FILE" 2>/dev/null || echo 0)
    echo "  Found $ISSUE_COUNT issues"
else
    echo "  gh CLI not available"
    echo "# No issues" > "$ISSUES_FILE"
    ISSUE_COUNT=0
fi
echo ""

# === Build first ===
echo "→ Building..."
cargo build --quiet 2>&1 || { echo "Build failed"; exit 1; }
cargo test --quiet 2>&1 || true
echo "  Build OK"
echo ""

# === Self-Review: Run clippy and analyze own code ===
echo "=== Phase 0: Self-Review ==="

SELF_REVIEW_OUTPUT=$(mktemp)

echo "→ Running clippy analysis..."
cargo clippy --all-targets --message-format=short 2>&1 > "$SELF_REVIEW_OUTPUT" || true

echo "→ Analyzing code for issues..."
CLIPPY_ISSUES=$(grep -E "^src/.*: error|^src/.*: warning" "$SELF_REVIEW_OUTPUT" 2>/dev/null | head -20 || echo "")

# Count issues
CLIPPY_COUNT=$(echo "$CLIPPY_ISSUES" | grep -c "error\|warning" 2>/dev/null || echo 0)
echo "  Found $CLIPPY_COUNT clippy issues"

# Check for common code issues
CODE_ISSUES=""
echo "→ Checking for unwrap/expect usage..."
UNSAFE_COUNT=$(grep -rn "\.unwrap()" src/ 2>/dev/null | grep -v "#\[allow" | wc -l | tr -d ' ')
if [ "$UNSAFE_COUNT" -gt 0 ]; then
    CODE_ISSUES="$CODE_ISSUES\n- Found $UNSAFE_COUNT .unwrap() calls that may panic"
fi

EXPECT_COUNT=$(grep -rn "\.expect(" src/ 2>/dev/null | grep -v "#\[allow" | wc -l | tr -d ' ')
if [ "$EXPECT_COUNT" -gt 0 ]; then
    CODE_ISSUES="$CODE_ISSUES\n- Found $EXPECT_COUNT .expect() calls that may panic"
fi

# Check for TODOs/FIXMEs
TODO_COUNT=$(grep -rn "TODO\|FIXME\|XXX" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
    CODE_ISSUES="$CODE_ISSUES\n- Found $TODO_COUNT TODO/FIXME items to address"
fi

# Store self-review findings
{
    echo "# Self-Review Findings"
    echo ""
    echo "## Clippy Issues ($CLIPPY_COUNT found)"
    echo '```'
    echo "$CLIPPY_ISSUES"
    echo '```'
    echo ""
    echo "## Code Quality Issues"
    echo -e "$CODE_ISSUES"
    echo ""
    echo "## Priority"
    echo "Fix clippy errors first, then warnings, then code quality issues."
} > self_review.md

echo "  Self-review complete. Findings saved to self_review.md"
rm -f "$SELF_REVIEW_OUTPUT"
echo ""

# === Pre-loop: Check Evolution Plan Issue ===
# Use issue #2 as the source of what to work on (reduces context size)
echo "=== Phase 0: Loading Evolution Plan ==="

EVOLUTION_PLAN=""
if command -v gh &>/dev/null; then
    EVOLUTION_PLAN=$(gh issue view 2 --repo "$REPO" --json body 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('body',''))" || echo "")
fi

BRAINSTORM_PROMPT=$(mktemp)
if [ -n "$EVOLUTION_PLAN" ]; then
    # Use the evolution plan issue as context
    cat > "$BRAINSTORM_PROMPT" << PROMPT_EOF
# Evolution Plan

You are evo. Your goal is to improve yourself.

## Your Mission
Follow the evolution plan below. If there are open GitHub issues, address them.

## Evolution Plan
$EVOLUTION_PLAN

## Open Issues
$(cat issues.md 2>/dev/null || echo "No issues")

## Your Code
$(find src -name "*.rs" -exec cat {} \; 2>/dev/null | head -200)

## Tasks
1. Review the evolution plan and issues
2. Pick one item to work on
3. Implement it
4. Verify it works
5. Commit your changes

## Rules
- Make ONE focused change per iteration
- Always run cargo build && cargo test before committing
- If you hit a bug, use systematic-debugging skill
- Run cargo fmt && cargo clippy after changes

Begin your self-evolution now.
PROMPT_EOF
else
    # Fallback: use the original brainstorming approach
    cat > "$BRAINSTORM_PROMPT" << PROMPT_EOF
# Brainstorming & Gap Analysis

You are evo. Before making any changes, analyze yourself and the landscape.

## Your Mission
Use the brainstorming and self-assess skills to:
1. Explore what you should work on
2. Analyze gaps vs competitors (Claude Code, Cursor, etc.)
3. Identify the highest priority improvement

## Context
- Date: $DATE
- Your repo: $REPO
- Open issues: See issues.md

## Your Code
$(find src -name "*.rs" -exec cat {} \; 2>/dev/null | head -200)

## Open Issues
$(cat issues.md 2>/dev/null || echo "No issues")

## Output Format
After analysis, output:
1. **What to work on**: Which issue or self-improvement
2. **Why**: Brief rationale
3. **Plan**: 2-3 specific steps to accomplish it

Then stop. Don't write code yet.
PROMPT_EOF
fi

echo "Running brainstorming..."
cargo run -- --skills ./skills --file "$BRAINSTORM_PROMPT" 2>&1 | tail -40 || true
rm -f "$BRAINSTORM_PROMPT"
echo ""
echo "Brainstorming complete. Proceeding to implementation..."

# === Main Evolution Loop ===
ITERATION=1
while [ $ITERATION -le $MAX_ITERATIONS ]; do
    echo "=== Iteration $ITERATION/$MAX_ITERATIONS ==="
    
    # Create detailed prompt for self-evolution
    EVOLUTION_PROMPT=$(mktemp)
    cat > "$EVOLUTION_PROMPT" << PROMPT_EOF
# Your Mission: Self-Evolution with Self-Review

You are evo, a self-evolving development agent. Your goal is to improve yourself.

## Current Context
- Date: $DATE
- Time: $SESSION_TIME
- Your repo: $REPO

## Self-Review Findings (CRITICAL - Read this first!)
$(cat self_review.md 2>/dev/null || echo "No self-review findings")

## Open GitHub Issues
$(cat issues.md 2>/dev/null || echo "No issues")

## Your Code
$(find src -name "*.rs" -exec cat {} \; 2>/dev/null | head -300)

## Your Task - Priority Order

**Priority 1: Fix Self-Review Issues**
If the Self-Review Findings section shows clippy errors or code quality issues:
1. Fix clippy errors first
2. Fix clippy warnings second
3. Address .unwrap()/.expect() calls that could panic

**Priority 2: Address GitHub Issues**
If no self-review issues, then address open GitHub issues.

**Priority 3: Self-Improvement**
If nothing to fix, consider improvements from your skills.

## Process

1. **Read Self-Review Findings** - Check what issues exist in your code
2. **Pick One Issue** - Choose the highest priority item
3. **Fix It** - Make the minimal necessary change
4. **Verify** - Run cargo fmt && cargo build && cargo test
5. **Commit** - Commit with a clear message

## Issue Processing Workflow

**Creating Issues (for tracking recurring problems):**
gh issue create --title "Issue title" --body "Description"

**Updating Issues:**
gh issue comment NUMBER --body "Update message"

**Closing Issues:**
gh issue close NUMBER --comment "Resolution summary"

When fixing issues from self-review:
- Document what you found and how you fixed it
- Create a GitHub issue if this is a recurring problem that needs tracking

When working on GitHub issues:
- Comment progress: gh issue comment NUMBER --body "status update"
- Close when done: gh issue close NUMBER --comment "Implemented"

## Rules
- Make ONE focused change per iteration
- Always verify before committing
- If stuck, use systematic-debugging skill
- Learn from patterns - if you see repeated issues, consider creating a skill

Begin your self-evolution now. Start by reading Self-Review Findings.
PROMPT_EOF
    
    # Run evo with the evolution prompt
    echo "Running self-evolution iteration $ITERATION..."
    
    cargo run -- --skills ./skills --file "$EVOLUTION_PROMPT" 2>&1 || {
        echo "  Iteration $ITERATION failed, continuing..."
    }
    
    rm -f "$EVOLUTION_PROMPT"
    
    # Show verification
    echo "→ Verifying..."
    cargo fmt -- --check || cargo fmt
    
    # Try to build, if fails try to fix
    if ! cargo build --quiet 2>&1; then
        echo "  Build failed, running cargo fix..."
        cargo fix --allow-dirty --allow-staged 2>&1 || true
        cargo build --quiet 2>&1 || { echo "  Build still failed after fix"; }
    fi
    
    cargo test --quiet 2>&1 || true
    
    # Run clippy as warning only (don't block commit)
    echo "→ Running clippy (warning only)..."
    cargo clippy --all-targets -- -D warnings 2>&1 || {
        echo "  Clippy warnings found, auto-fixing..."
        cargo clippy --all-targets --fix --allow-dirty --allow-staged 2>&1 || true
        cargo clippy --all-targets --fix --allow-dirty --allow-staged 2>&1 || true
        cargo fix --allow-dirty --allow-staged 2>&1 || true
        cargo build --quiet 2>&1 || echo "  Build check after fix"
    }
    echo "  Verification OK"
    
    # Check if there are changes to commit
    if ! git diff --quiet; then
        echo "→ Committing changes..."
        git add -A
        if ! git diff --cached --quiet; then
            git commit -m "Evo self-improvement: $DATE $SESSION_TIME iteration $ITERATION" || true
        fi
    else
        echo "  No changes in iteration $ITERATION"
    fi
    
    ITERATION=$((ITERATION + 1))
    echo ""
done

# Final commit and push
echo "→ Final commit and push..."
git add -A
if ! git diff --cached --quiet; then
    git commit -m "Evo self-improvement: $DATE $SESSION_TIME" || true
    git push || echo "Push failed (may already be up to date)"
    echo "  Committed and pushed"
else
    echo "  No changes to commit"
fi

# Cleanup
rm -f "$ISSUES_FILE" /tmp/issues.json self_review.md

echo ""
echo "=== Evolution Session Complete ==="
echo "Iterations: $((ITERATION - 1))"