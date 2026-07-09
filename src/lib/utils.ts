import { Section, SectionInput } from "../types";

// Simple ID generator based on title (fallback if no match)
export const generateId = (title: string, index: number) => {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
};

/** Whitespace-split word count of a string (0 for blank). The one definition. */
export const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
};

export const computeHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
};

/**
 * Build the synthetic document-root node. The parsed hierarchy has no persisted
 * root — `parseMarkdown` constructs one as a parsing accumulator and then returns
 * only its children — so callers that need to operate on the whole document
 * (root-level select / spec / analyze / evaluate) materialize it on demand here.
 *
 * The id is the stable 'root' (matching `parseMarkdown` and the treemap), so any
 * results stored under `testSuite['root']` persist across re-parses. `fullContent`
 * is the entire markdown; `children` are the already-parsed top-level sections.
 */
export const buildRootSection = (
  md: string,
  children: Section[],
  title = 'Document Root',
): Section => ({
  id: 'root',
  title,
  level: 0,
  content: '',
  fullContent: md,
  startLine: 0,
  // Inclusive last-line index, matching parseMarkdown's endLine convention
  // (was one-past-the-end, an off-by-one against every other Section).
  endLine: Math.max(0, md.split('\n').length - 1),
  startOffset: 0,
  wordCount: md.split(/\s+/).filter((w) => w.length > 0).length,
  children,
  parentId: null,
});

// Markdown Parser
export const parseMarkdown = (
  md: string, 
  oldSections: Section[] = [],
  forcedTitleToIdMap?: Record<string, string[]>
): Section[] => {
  const lines = md.split('\n');
  
  // Flatten old sections for matching
  const oldNodes: Section[] = [];
  const traverseOld = (nodes: Section[]) => {
    nodes.forEach(n => {
      oldNodes.push(n);
      traverseOld(n.children);
    });
  };
  traverseOld(oldSections);

  // Id reuse is assigned OLD-NODE-CENTRICALLY: each old section claims the
  // same-title new heading whose BODY matches its own (first non-blank line),
  // then the nearest by line distance. Under the previous positional
  // consumption, pasting a duplicate of a later section's heading ABOVE it
  // stole that section's id — and with it its spec/goals/history in the
  // testSuite; body affinity + proximity keeps an unmoved section's id with
  // the section it has always named.
  const newHeadingLinesByTitle: Record<string, number[]> = {};
  lines.forEach((line, index) => {
    const m = line.match(/^(#{1,6})\s+(.*)/);
    if (m) (newHeadingLinesByTitle[m[2]] ??= []).push(index);
  });
  const firstBodyLineAfter = (headingLine: number): string => {
    for (let i = headingLine + 1; i < lines.length; i++) {
      if (/^(#{1,6})\s+/.test(lines[i])) return '';
      if (lines[i].trim()) return lines[i].trim();
    }
    return '';
  };
  const oldFirstBody = (n: Section): string => {
    for (const l of n.content.split('\n').slice(1)) {
      if (l.trim()) return l.trim();
    }
    return '';
  };
  const reusedIdByLine = new Map<number, string>();
  const takenLines = new Set<number>();
  oldNodes.forEach(n => {
    const body = oldFirstBody(n);
    let best = -1;
    let bestScore = -Infinity;
    for (const l of newHeadingLinesByTitle[n.title] || []) {
      if (takenLines.has(l)) continue;
      const bodyMatch = body !== '' && firstBodyLineAfter(l) === body;
      // Body affinity dominates; distance breaks body ties.
      const score = (bodyMatch ? 1_000_000 : 0) - Math.abs(l - n.startLine);
      if (score > bestScore) {
        best = l;
        bestScore = score;
      }
    }
    if (best >= 0) {
      takenLines.add(best);
      reusedIdByLine.set(best, n.id);
    }
  });

  // Calculate start offset for each line
  const lineOffsets: number[] = [];
  let currentOffset = 0;
  for (const line of lines) {
      lineOffsets.push(currentOffset);
      currentOffset += line.length + 1; // +1 for the newline character
  }

  const root = buildRootSection(md, []);

  const stack: Section[] = [root];

  // Deep copy forcedTitleToIdMap so we can pop from it
  const forcedMap = forcedTitleToIdMap ? JSON.parse(JSON.stringify(forcedTitleToIdMap)) : null;

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.*)/);
    if (match) {
      const level = match[1].length;
      const title = match[2];
      
      // Determine ID: try to reuse from forced map, then oldSections, then generate
      let id = generateId(title, index);
      
      if (forcedMap && forcedMap[title] && forcedMap[title].length > 0) {
        id = forcedMap[title].shift(); // take the first matched ID from the forced map
      } else {
        const reused = reusedIdByLine.get(index);
        if (reused) id = reused;
      }

      const newNode: Section = {
        id,
        title,
        level,
        content: '',
        fullContent: '',
        startLine: index,
        endLine: index, // will be updated
        startOffset: lineOffsets[index],
        wordCount: 0,
        children: [],
        parentId: null
      };

      // Find parent
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      newNode.parentId = parent.id;
      parent.children.push(newNode);
      stack.push(newNode);
    }
  });

  // Calculate contents
  const traverse = (node: Section, nextNodeLine: number) => {
    node.endLine = nextNodeLine - 1;
    // Extract text
    const sectionLines = lines.slice(node.startLine, nextNodeLine);
    
    // The "content" of this section (text before the next sub-header)
    let childStartIndex = nextNodeLine;
    if (node.children.length > 0) {
      childStartIndex = node.children[0].startLine;
    }
    
    node.content = lines.slice(node.startLine, childStartIndex).join('\n');
    node.fullContent = sectionLines.join('\n');
    node.wordCount = node.fullContent.split(/\s+/).filter(w => w.length > 0).length;

    // Recurse
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const nextSiblingStart = (i < node.children.length - 1) 
        ? node.children[i + 1].startLine 
        : nextNodeLine;
      traverse(child, nextSiblingStart);
    }
  };

  traverse(root, lines.length);

  return root.children; // Return top level nodes
};

/**
 * Flatten the parsed section tree into the rows handed DOWN to the Rust search
 * indexer (`Repository.indexSections`). Document order; `ordinal` increments
 * across the whole flattened list. Reuses the existing parser's output rather
 * than duplicating a markdown parser in Rust.
 */
export const flattenSectionsForIndex = (nodes: Section[]): SectionInput[] => {
  const out: SectionInput[] = [];
  let ordinal = 0;
  const walk = (list: Section[]) => {
    for (const n of list) {
      out.push({
        id: n.id,
        parentId: n.parentId ?? null,
        title: n.title,
        level: n.level,
        ordinal: ordinal++,
        content: n.content,
        wordCount: n.wordCount,
      });
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

// Flatten tree for Plotly
export const flattenTree = (nodes: Section[], parentId: string = 'root') => {
  let flat: any[] = [];
  nodes.forEach(node => {
    flat.push({
      id: node.id,
      label: node.title,
      parent: parentId,
      value: node.wordCount || 1, // Ensure visibility even if empty
      content: node.content,
      // Carried for the treemap's screen-reader mirror (level/title/exact count).
      title: node.title,
      level: node.level,
      wordCount: node.wordCount,
    });
    if (node.children.length > 0) {
      flat = flat.concat(flattenTree(node.children, node.id));
    }
  });
  return flat;
};

/** Depth-first lookup of a section by id in a section tree; null if absent. */
export const findSectionById = (nodes: Section[], id: string): Section | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSectionById(node.children, id);
    if (found) return found;
  }
  return null;
};

/**
 * Robustly extract and parse JSON from AI responses that might contain preamble/postamble.
 */
export const safeJsonParse = (text: string, fallback: any = {}) => {
  if (!text) return fallback;
  
  try {
    // Attempt direct parse first
    return JSON.parse(text);
  } catch (e) {
    try {
      // 1. Try to extract from ```json ... ``` or generic ``` ... ``` blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (matchErr) {
          // If the matched block isn't valid, fall through to the brace-matching logic
        }
      }

      // 2. Find first '{' and iteratively search backwards for a matching '}' that parses
      const firstBrace = text.indexOf('{');
      if (firstBrace !== -1) {
        let lastBrace = text.lastIndexOf('}');
        while (lastBrace > firstBrace) {
          const potentialJson = text.slice(firstBrace, lastBrace + 1);
          try {
            return JSON.parse(potentialJson);
          } catch (innerE) {
            // Step back to the previous '}' and try again
            lastBrace = text.lastIndexOf('}', lastBrace - 1);
          }
        }
      }
      
      // 3. Try the same but for arrays '[' and ']'
      const firstBracket = text.indexOf('[');
      if (firstBracket !== -1) {
        let lastBracket = text.lastIndexOf(']');
        while (lastBracket > firstBracket) {
          const potentialJson = text.slice(firstBracket, lastBracket + 1);
          try {
            return JSON.parse(potentialJson);
          } catch (innerE) {
            // Step back to the previous ']' and try again
            lastBracket = text.lastIndexOf(']', lastBracket - 1);
          }
        }
      }

      console.error("Failed to recover JSON parsing, all attempts failed.");
    } catch (innerE) {
      console.error("Failed to recover JSON parsing:", innerE);
    }
    return fallback;
  }
};
