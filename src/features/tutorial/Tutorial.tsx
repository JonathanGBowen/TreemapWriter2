import React, { useState, useEffect } from 'react';
import { Joyride, Step, STATUS } from 'react-joyride';

interface TutorialProps {
  run: boolean;
  onFinish: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({ run, onFinish }) => {
  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onFinish();
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      title: 'Welcome to TreeMap Writer!',
      content: 'This is a powerful, AI-assisted markdown editor that helps you structure and write complex documents.',
    },
    {
      target: '.editor-panel-step',
      title: 'Markdown Editor',
      content: 'Write your document here using standard Markdown. Use headings (e.g., #, ##) to create new sections automatically.',
      placement: 'left',
    },
    {
      target: '.treemap-step',
      title: 'Structure Map',
      content: 'This interactive treemap visualizes your document\'s structure. Click any block to jump directly to that section in the editor. Colors indicate AI test status.',
      placement: 'right',
    },
    {
      target: '.tests-panel-step',
      title: 'AI Testing & Specs',
      content: 'Define goals and arguments for each section. Run AI tests to evaluate if your written content meets these goals. Manage section dependencies here as well.',
      placement: 'left',
    },
    {
      target: '.project-manager-step',
      title: 'Project Management',
      content: 'Manage your projects, import existing markdown files, or export your work. Your progress is auto-saved locally.',
      placement: 'right',
    }
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideCallback}
      options={{
        zIndex: 10000,
        primaryColor: '#00f0ff',
        backgroundColor: '#0d0d12',
        textColor: '#e2e8f0',
        arrowColor: '#0d0d12',
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip']
      }}
      styles={{
        tooltipContainer: {
          textAlign: 'left',
          fontFamily: 'Inter, sans-serif'
        },
        tooltipTitle: {
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '8px'
        },
        buttonPrimary: {
          backgroundColor: '#00f0ff',
          color: '#050505',
          borderRadius: '4px',
          padding: '8px 16px',
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          fontWeight: 600,
          fontSize: '12px'
        },
        buttonBack: {
          color: '#8b949e',
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          fontSize: '12px'
        },
        buttonSkip: {
          color: '#8b949e',
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          fontSize: '12px'
        }
      }}
    />
  );
};
