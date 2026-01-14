import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// Module-level flag to prevent double PTY initialization (persists across React.StrictMode re-renders)
let ptyStarted = false;

function ClaudeTerminal() {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#f0f0f0',
        cursor: '#00ff00',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#e6e6e6'
      },
      rows: 30,
      cols: 80
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Open terminal in the container
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    term.onData((data) => {
      window.electronAPI.terminalWrite(data);
    });

    // Start the PTY process (only once, even if React.StrictMode re-runs this effect)
    if (!ptyStarted) {
      ptyStarted = true;
      window.electronAPI.startTerminal().then((result) => {
        if (!result.success) {
          term.writeln('\x1b[1;31mFailed to start terminal: ' + result.error + '\x1b[0m');
          ptyStarted = false; // Reset on failure so it can be retried
        }
      });
    }

    // Listen for data from the PTY
    window.electronAPI.onTerminalData((data) => {
      term.write(data);
    });

    // Listen for terminal exit
    window.electronAPI.onTerminalExit(({ exitCode, signal }) => {
      term.writeln(`\r\n\x1b[1;33mTerminal process exited (code: ${exitCode}, signal: ${signal})\x1b[0m`);
      ptyStarted = false; // Reset flag so terminal can be started again
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          window.electronAPI.terminalResize(dims.cols, dims.rows);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial fit
    setTimeout(handleResize, 100);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success-500"></div>
          <span className="text-sm font-semibold text-neutral-200">Claude Code Terminal</span>
        </div>
        <div className="text-xs text-neutral-400">
          Running in: PersonalAssistant/
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="flex-1 p-2"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}

export default ClaudeTerminal;
