import yaml from 'js-yaml';
import { Section, TestSuite } from '../types';

export function createMarkdownExport(
  projectName: string,
  fullContent: string,
  sections: Section[],
  testSuite: TestSuite
): string {
  const blocks: Record<string, any> = {};
  
  // Flatten sections
  const flatSections: Section[] = [];
  const traverse = (s: Section[]) => {
    for (const sec of s) {
      if (sec.id !== 'root') flatSections.push(sec);
      traverse(sec.children);
    }
  };
  traverse(sections);

  for (const sec of flatSections) {
    const ts = testSuite[sec.id];
    if (ts) {
      blocks[sec.id] = {
        function: ts.spec?.function,
        mainClaim: ts.spec?.mainClaim,
        requiredMoves: ts.spec?.requiredMoves,
        incomingContext: ts.spec?.incomingContext,
        outgoingCommitments: ts.spec?.outgoingCommitments,
        goals: ts.goals,
        status: ts.status
      };
      
      // Clean up undefined/null properties
      for (const k of Object.keys(blocks[sec.id])) {
        if (blocks[sec.id][k] == null) delete blocks[sec.id][k];
      }
    }
  }

  const frontmatter = {
    treemapwriter: {
      version: 1,
      projectName: projectName || "Untitled Project",
      exported: new Date().toISOString(),
      blocks
    }
  };

  const yamlString = yaml.dump(frontmatter, {
    lineWidth: -1, // Do not wrap long strings
    noRefs: true,
  });
  
  // Inject HTML comments into markdown
  const lines = fullContent.split('\n');
  
  // Sort sections by startLine descending so index manipulation doesn't break
  const sortedSections = [...flatSections].sort((a, b) => b.startLine - a.startLine);
  
  for (const sec of sortedSections) {
    const headerMatch = lines[sec.startLine]?.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
       // Insert a blank line and the comment block underneath the header
       lines.splice(sec.startLine + 1, 0, '', `<!-- spec: ${sec.id} -->`);
    } else {
       lines.splice(sec.startLine + 1, 0, '', `<!-- spec: ${sec.id} -->`);
    }
  }
  
  return `---
${yamlString}---

${lines.join('\n')}`;
}
