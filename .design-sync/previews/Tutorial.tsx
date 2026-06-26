import { Tutorial } from 'treemap-writer';

const noop = () => {};

// Tutorial is a react-joyride overlay. Its first step targets `body` with
// placement "center", so it can render a centered welcome tooltip with no DOM
// tour targets present — which is all that exists in isolation (the later steps
// target .editor-panel-step / .treemap-step etc. that don't render here).
// run=true drives the first step; onFinish is a noop. Joyride renders its own
// fixed full-viewport overlay + dark tooltip, so no Frame is supplied.
export const Welcome = () => <Tutorial run onFinish={noop} />;
