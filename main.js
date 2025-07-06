class PythonCodeEditor {
    constructor() {
        this.pyodide = null;
        this.isLoading = false;
        this.initializeElements();
        this.setupEventListeners();
        this.updateLineNumbers();
        this.loadPyodide();
    }

    initializeElements() {
        this.codeInput = document.getElementById('codeInput');
        this.output = document.getElementById('output');
        this.runBtn = document.getElementById('runBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.loadBtn = document.getElementById('loadBtn');
        this.clearOutputBtn = document.getElementById('clearOutput');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.status = document.getElementById('status');
        this.lineCol = document.getElementById('lineCol');
        this.fontSize = document.getElementById('fontSize');
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        this.runBtn.addEventListener('click', () => this.runCode());
        this.clearBtn.addEventListener('click', () => this.clearCode());
        this.saveBtn.addEventListener('click', () => this.saveCode());
        this.loadBtn.addEventListener('change', (e) => this.loadCode(e));
        this.clearOutputBtn.addEventListener('click', () => this.clearOutput());
        this.fontSize.addEventListener('change', (e) => this.changeFontSize(e));
        
        this.codeInput.addEventListener('input', () => {
            this.updateLineNumbers();
            this.updateStatus();
        });
        
        this.codeInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.codeInput.addEventListener('scroll', () => this.syncScroll());
        this.codeInput.addEventListener('click', () => this.updateCursorPosition());
        this.codeInput.addEventListener('keyup', () => this.updateCursorPosition());
    }

    async loadPyodide() {
        try {
            this.loading.classList.remove('hidden');
            this.updateStatus('Loading Python environment...', 'loading');
            
            this.pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            
            // Redirect Python stdout to our output
            this.pyodide.runPython(`
                import sys
                from io import StringIO
                
                class OutputCapture:
                    def __init__(self):
                        self.output = StringIO()
                    
                    def write(self, text):
                        self.output.write(text)
                    
                    def flush(self):
                        pass
                    
                    def get_output(self):
                        return self.output.getvalue()
                    
                    def clear(self):
                        self.output = StringIO()
                
                _output_capture = OutputCapture()
                sys.stdout = _output_capture
                sys.stderr = _output_capture
            `);
            
            this.loading.classList.add('hidden');
            this.updateStatus('Python environment loaded successfully', 'success');
            this.runBtn.disabled = false;
            
        } catch (error) {
            this.loading.classList.add('hidden');
            this.updateStatus('Failed to load Python environment', 'error');
            this.appendOutput(`Error loading Pyodide: ${error.message}`, 'error');
        }
    }

    async runCode() {
        if (!this.pyodide) {
            this.appendOutput('Python environment not loaded yet. Please wait...', 'error');
            return;
        }

        const code = this.codeInput.value.trim();
        if (!code) {
            this.appendOutput('No code to run', 'error');
            return;
        }

        this.runBtn.disabled = true;
        this.updateStatus('Running code...', 'loading');
        
        try {
            // Clear previous output capture
            this.pyodide.runPython('_output_capture.clear()');
            
            // Run the user code
            await this.pyodide.runPythonAsync(code);
            
            // Get the captured output
            const output = this.pyodide.runPython('_output_capture.get_output()');
            
            if (output.trim()) {
                this.appendOutput(output, 'success');
            } else {
                this.appendOutput('Code executed successfully (no output)', 'success');
            }
            
            this.updateStatus('Code executed successfully', 'success');
            
        } catch (error) {
            this.appendOutput(`Error: ${error.message}`, 'error');
            this.updateStatus('Execution failed', 'error');
        } finally {
            this.runBtn.disabled = false;
        }
    }

    appendOutput(text, type = 'normal') {
        const timestamp = new Date().toLocaleTimeString();
        const outputLine = document.createElement('div');
        outputLine.className = type;
        outputLine.textContent = `[${timestamp}] ${text}`;
        this.output.appendChild(outputLine);
        this.output.scrollTop = this.output.scrollHeight;
    }

    clearCode() {
        this.codeInput.value = '';
        this.updateLineNumbers();
        this.updateStatus('Code cleared', 'success');
        this.updateCursorPosition();
    }

    clearOutput() {
        this.output.innerHTML = '';
        this.updateStatus('Output cleared', 'success');
    }

    saveCode() {
        const code = this.codeInput.value;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'code.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.updateStatus('Code saved', 'success');
    }

    loadCode(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.codeInput.value = e.target.result;
                this.updateLineNumbers();
                this.updateStatus(`Loaded ${file.name}`, 'success');
                this.updateCursorPosition();
            };
            reader.readAsText(file);
        }
    }

    changeFontSize(event) {
        const size = event.target.value + 'px';
        this.codeInput.style.fontSize = size;
        this.lineNumbers.style.fontSize = size;
        this.output.style.fontSize = size;
    }

    updateLineNumbers() {
        const lines = this.codeInput.value.split('\n');
        const lineCount = lines.length;
        let lineNumbersHtml = '';
        
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHtml += i + '\n';
        }
        
        this.lineNumbers.textContent = lineNumbersHtml;
    }

    syncScroll() {
        this.lineNumbers.scrollTop = this.codeInput.scrollTop;
    }

    updateCursorPosition() {
        const textarea = this.codeInput;
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        const textBeforeCursor = text.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentColumn = lines[lines.length - 1].length + 1;
        
        this.lineCol.textContent = `Line ${currentLine}, Column ${currentColumn}`;
    }

    updateStatus(message, type = 'normal') {
        this.status.textContent = message;
        this.status.className = type;
        
        // Clear status after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (this.status.textContent === message) {
                    this.status.textContent = 'Ready';
                    this.status.className = '';
                }
            }, 3000);
        }
    }

    handleKeyDown(event) {
        // Handle Tab key for indentation
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = this.codeInput.selectionStart;
            const end = this.codeInput.selectionEnd;
            const value = this.codeInput.value;
            
            // Insert 4 spaces
            this.codeInput.value = value.substring(0, start) + '    ' + value.substring(end);
            this.codeInput.selectionStart = this.codeInput.selectionEnd = start + 4;
            
            this.updateLineNumbers();
        }
        
        // Handle Ctrl+Enter to run code
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.runCode();
        }
        
        // Handle Ctrl+S to save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.saveCode();
        }
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PythonCodeEditor();
});

// Add some helpful keyboard shortcuts info
console.log(`
Python Code Editor Shortcuts:
- Ctrl+Enter: Run code
- Ctrl+S: Save code
- Tab: Insert 4 spaces (indentation)
`);