import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DropZone } from './DropZone';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  HardDrive: () => <div data-testid="icon-hard-drive" />,
  Upload: () => <div data-testid="icon-upload" />
}));

describe('DropZone UI Component', () => {

  it('renders strictly in the empty idle dashboard state', () => {
    // Array of active job ids
    const activeQueue: string[] = []; 
    render(<DropZone isDragActive={false} activeQueue={activeQueue} handleSelectFiles={vi.fn()} />);

    // The component acts as a pure layout module, ALWAYS rendering its core prompts natively
    expect(screen.getByText('Drop Files & Folders Here')).toBeInTheDocument();
    
    // Ensure the conditional Start button is injected
    expect(screen.getByText('Start Processing')).toBeInTheDocument();
  });

  it('shifts dynamically into the hover-drop boundary UI', () => {
    const activeQueue: string[] = []; 
    render(<DropZone isDragActive={true} activeQueue={activeQueue} handleSelectFiles={vi.fn()} />);

    expect(screen.getByText('Drop Files & Folders Here')).toBeInTheDocument();
  });
});
