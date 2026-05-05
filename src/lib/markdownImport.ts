import yaml from 'js-yaml';
import { TestSuite } from '../types';

export interface ImportResult {
  markdown: string;
  projectName?: string;
  rawBlocks: Record<string, any>;
  titleToIdMap: Record<string, string[]>;
}

export function parseMarkdownImport(rawContent: string): ImportResult {
  let markdown = rawContent;
  let projectName = undefined;
  let rawBlocks: Record<string, any> = {};

  // Try to parse frontmatter
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = rawContent.match(frontmatterRegex);

  if (match) {
    const yamlString = match[1];
    try {
      const parsed = yaml.load(yamlString) as any;
      if (parsed && parsed.treemapwriter) {
        projectName = parsed.treemapwriter.projectName;
        rawBlocks = parsed.treemapwriter.blocks || {};
      }
    } catch (e) {
      console.warn("Failed to parse markdown frontmatter:", e);
    }
    
    // Remove frontmatter from the markdown content
    markdown = rawContent.slice(match[0].length);
  }

  const lines = markdown.split(/\r?\n/);
  const cleanLines: string[] = [];
  
  let currentHeader: { lineIndex: number, text: string } | null = null;
  const titleToIdMap: Record<string, string[]> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      currentHeader = { lineIndex: cleanLines.length, text: headerMatch[2] };
      cleanLines.push(line);
      continue;
    }
    
    const commentMatch = line.match(/^<!--\s*spec:\s*([^\s-]+(?:-[^\s-]+)*)\s*-->$/);
    if (commentMatch) {
      const id = commentMatch[1];
      if (currentHeader) {
         if (!titleToIdMap[currentHeader.text]) titleToIdMap[currentHeader.text] = [];
         titleToIdMap[currentHeader.text].push(id);
         
         if (cleanLines.length > 0 && cleanLines[cleanLines.length - 1].trim() === '') {
             cleanLines.pop(); 
         }
      }
      continue; // Skip the comment line
    }
    
    cleanLines.push(line);
  }

  markdown = cleanLines.join('\n');

  return {
    markdown,
    projectName,
    rawBlocks,
    titleToIdMap,
  };
}
