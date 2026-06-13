import React, { useState, useMemo } from "react";
import { Check, Copy } from "lucide-react";

import { PromptsConfig } from "../../types";
import { useStore } from "../../store";
import { useModelChoice } from "./use-model-choice";
import { ModalShell } from "./ModalShell";
import { SegControl, type SegOption } from "./SegControl";
import { Disclosure } from "../shared/Disclosure";
import { Pip } from "../shared/Pip";
import { resolveDepthChoice, tierOf, depthModelLabel } from "./depth-choice";
import type { ModelTier } from "../../services/ai/model-catalog";
import type { ModelChoice } from "../../services/ai/model-types";

interface InterpolationModalProps {
  onConfirm: (choice: ModelChoice, config: PromptsConfig) => void;
  documentStats: {
    wordCount: number;
    sectionCount: number;
    depth: number;
  };
  initialConfig: PromptsConfig;
}

const DEPTH_TIERS: ModelTier[] = ['fast', 'balanced', 'deep'];
const DEPTH_GLYPHS = ['»', '»»', '◆'];
const DEPTH_LABELS = ['Fast', 'Balanced', 'Deep'];

const fieldClass =
  "w-full p-[9px] text-[11px] leading-relaxed border border-hld-border bg-hld-surface2 text-hld-text " +
  "focus:border-hld-cyan outline-none resize-none font-mono placeholder-hld-muted/50";

/** Copies the prompt structure; flips to "Copied" briefly. Lives inside the disclosure. */
function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy analysis prompt structure to clipboard"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 border transition-colors ${
        copied ? 'border-hld-green/50 text-hld-green' : 'border-hld-border text-hld-muted-text hover:text-hld-cyan'
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy prompt'}
    </button>
  );
}

/** The three prompt editors, restyled to square/hairline; collapsed by default. */
function PromptEditors({
  config,
  setConfig,
  copyText,
}: {
  config: PromptsConfig;
  setConfig: (c: PromptsConfig) => void;
  copyText: string;
}) {
  const fields: [keyof PromptsConfig, string][] = [
    ['systemInstruction', 'System instruction (global)'],
    ['l1TaskInstruction', 'Level 1 task (root & main sections)'],
    ['subTaskInstruction', 'Sub-level task (subsections)'],
  ];
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex justify-end">
        <CopyPromptButton text={copyText} />
      </div>
      {fields.map(([key, label]) => (
        <label key={key} className="block">
          <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-hld-muted-text mb-[4px]">
            {label}
          </span>
          <textarea
            value={config[key]}
            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
            className={`${fieldClass} ${key === 'systemInstruction' ? 'h-20' : 'h-28'}`}
            placeholder={`Enter the ${label.toLowerCase()}...`}
          />
        </label>
      ))}
    </div>
  );
}

export const InterpolationModal: React.FC<InterpolationModalProps> = ({ onConfirm, documentStats, initialConfig }) => {
  const isOpen = useStore((s) => s.showInterpolationModal);
  const setShow = useStore((s) => s.setShowInterpolationModal);
  const catalog = useStore((s) => s.modelCatalog);
  const onClose = () => setShow(false);
  const [choice, setChoice] = useModelChoice('generateSpecs', isOpen);
  const [config, setConfig] = useState<PromptsConfig>(initialConfig);

  const thinkingBudget = choice.thinkingBudget ?? 0;
  const estimates = useMemo(() => {
    const inputBaseTokens = Math.ceil(documentStats.wordCount * 1.3);
    const batches = Math.max(1, Math.ceil(documentStats.depth / 2)) + 1;
    const input = inputBaseTokens * batches;
    const thinking = thinkingBudget * batches;
    const output = documentStats.sectionCount * 150;
    return { batches, total: input + thinking + output };
  }, [documentStats, thinkingBudget]);

  if (!isOpen) return null;

  const depthIndex = DEPTH_TIERS.indexOf(tierOf(catalog, choice));
  const depthOptions: SegOption[] = DEPTH_TIERS.map((tier, i) => ({
    glyph: DEPTH_GLYPHS[i],
    label: DEPTH_LABELS[i],
    fine: depthModelLabel(catalog, choice, tier),
  }));
  const edited =
    config.systemInstruction !== initialConfig.systemInstruction ||
    config.l1TaskInstruction !== initialConfig.l1TaskInstruction ||
    config.subTaskInstruction !== initialConfig.subTaskInstruction;
  const copyText = [
    config.systemInstruction,
    "\nLEVEL 1 TASK:\n", config.l1TaskInstruction,
    "\nSUB-TASK:\n", config.subTaskInstruction,
  ].join("\n");

  return (
    <ModalShell
      eyebrow="AI · Structural analysis"
      title="Generate Specs"
      sub={`${documentStats.sectionCount} sections · whole document`}
      onClose={onClose}
      onPrimary={() => onConfirm(choice, config)}
      primaryLabel="▸ Start analysis"
    >
      <div className="flex flex-col gap-[16px]">
        <div>
          <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-hld-cyan mb-[8px]">Depth</div>
          <SegControl
            ariaLabel="Analysis depth"
            options={depthOptions}
            value={depthIndex < 0 ? 1 : depthIndex}
            onChange={(i) => setChoice(resolveDepthChoice(catalog, choice, DEPTH_TIERS[i]))}
          />
        </div>

        <div className="flex items-center gap-[8px] font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text">
          <Pip status="dim" size="sm" />
          ≈ {estimates.batches} batches · ~{(estimates.total / 1000).toFixed(0)}k tokens — estimate
        </div>

        <Disclosure label="Edit prompts" count={`3 · ${edited ? 'edited' : 'defaults'}`}>
          <PromptEditors config={config} setConfig={setConfig} copyText={copyText} />
        </Disclosure>
      </div>
    </ModalShell>
  );
};
