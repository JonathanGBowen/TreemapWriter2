import type { ReactNode } from 'react';
import { Pip } from 'treemap-writer';

// Dark HLD canvas — the generated card body is white, so every preview supplies
// its own #05090d surface + light text + Inter, full-bleed over the 24px gutter.
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-3">
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text w-[120px]">{label}</span>
    {children}
  </div>
);

// The one state vocabulary — every status diamond at md size.
export const States = () => (
  <Frame>
    <div className="flex flex-col gap-[14px]">
      <Row label="green · done"><Pip status="green" title="done" /></Row>
      <Row label="cyan · active"><Pip status="cyan" title="active" /></Row>
      <Row label="yellow · attention"><Pip status="yellow" title="attention" /></Row>
      <Row label="magenta · missing"><Pip status="magenta" title="missing" /></Row>
      <Row label="purple · secondary"><Pip status="purple" title="secondary" /></Row>
      <Row label="idle · untouched"><Pip status="idle" title="untouched" /></Row>
      <Row label="dim · inert"><Pip status="dim" title="inert" /></Row>
    </div>
  </Frame>
);

// Three sizes, plus the slow attention pulse.
export const SizesAndPulse = () => (
  <Frame>
    <div className="flex flex-col gap-[16px]">
      <Row label="sm · md · lg">
        <div className="flex items-center gap-4">
          <Pip status="cyan" size="sm" />
          <Pip status="cyan" size="md" />
          <Pip status="cyan" size="lg" />
        </div>
      </Row>
      <Row label="pulse (in-flight)"><Pip status="cyan" size="lg" pulse /></Row>
    </div>
  </Frame>
);
