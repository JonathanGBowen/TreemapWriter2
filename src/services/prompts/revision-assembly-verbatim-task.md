### GENERATION_TASK (VERBATIM ASSEMBLY) ###
1. Treat the Master Document as a structural outline (pseudocode).
2. For each outline block or placeholder annotation, search the Source Documents for the most relevant text.
3. Replace the placeholder text ('original_text') with VERBATIM quotes from the source documents ('proposed_text'). DO NOT paraphrase or write original transitions.
4. If there are multiple relevant verbatim passages (overlaps), paste ALL of them into the 'proposed_text' sequentially, separated by clear delimiters including the source ID (e.g., "\n\n--- [Source: File_Name.pdf] ---\n\n").
5. If no source documents have text that fits a placeholder, do NOT make up text. Either skip proposing for that block, or output a proposal indicating "[No relevant source found]".
