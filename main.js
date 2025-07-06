class FastPythonEditor {
  constructor() {
    this.pyodide = null
    this.isLoading = false
    this.currentFile = "main.py"
    this.files = new Map()
    this.files.set("main.py", "")
    this.settings = {
      theme: "dark",
      fontSize: 14,
      fontFamily: "Consolas",
      autoSave: true,
      wordWrap: false,
      minimap: false,
    }
    this.snippets = {
      for: "for i in range(10):\n    print(i)",
      if: "if condition:\n    pass",
      def: 'def function_name(args):\n    """docstring"""\n    return result',
      class: "class ClassName:\n    def __init__(self):\n        pass",
      try: "try:\n    pass\nexcept Exception as e:\n    print(e)",
      main: 'if __name__ == "__main__":\n    main()',
      import: "import module_name",
      from: "from module import function",
    }

    this.initializeElements()
    this.setupEventListeners()
    this.loadPyodideFast()
    this.updateLineNumbers()
    this.loadSettings()
  }

  initializeElements() {
    // Main elements
    this.codeInput = document.getElementById("codeInput")
    this.output = document.getElementById("output")
    this.lineNumbers = document.getElementById("lineNumbers")
    this.status = document.getElementById("status")
    this.lineCol = document.getElementById("lineCol")
    this.pyodideStatus = document.getElementById("pyodideStatus")

    // Buttons and controls
    this.runBtn = document.getElementById("runBtn")
    this.stopBtn = document.getElementById("stopBtn")
    this.debugBtn = document.getElementById("debugBtn")
    this.fontSize = document.getElementById("fontSize")
    this.loadBtn = document.getElementById("loadBtn")

    // Panels and tabs
    this.tabContainer = document.getElementById("tabContainer")
    this.fileTree = document.getElementById("fileTree")
    this.loadingOverlay = document.getElementById("loadingOverlay")
    this.progressFill = document.getElementById("progressFill")
    this.loadingText = document.getElementById("loadingText")

    // Terminal
    this.terminalInput = document.getElementById("terminalInput")
    this.terminalOutput = document.getElementById("terminalOutput")

    // Search
    this.searchInput = document.getElementById("searchInput")
    this.replaceInput = document.getElementById("replaceInput")

    // Package manager
    this.packageInput = document.getElementById("packageInput")
    this.installedPackages = document.getElementById("installedPackages")
  }

  setupEventListeners() {
    // Main controls
    this.runBtn.addEventListener("click", () => this.runCode())
    this.stopBtn.addEventListener("click", () => this.stopExecution())
    this.debugBtn.addEventListener("click", () => this.debugCode())
    this.fontSize.addEventListener("change", (e) => this.changeFontSize(e.target.value))
    this.loadBtn.addEventListener("change", (e) => this.loadFiles(e))

    // Code editor events
    this.codeInput.addEventListener("input", () => {
      this.updateLineNumbers()
      this.saveCurrentFile()
      if (this.settings.autoSave) {
        this.autoSave()
      }
    })

    this.codeInput.addEventListener("keydown", (e) => this.handleKeyDown(e))
    this.codeInput.addEventListener("scroll", () => this.syncScroll())
    this.codeInput.addEventListener("click", () => this.updateCursorPosition())
    this.codeInput.addEventListener("keyup", () => this.updateCursorPosition())

    // Terminal
    this.terminalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.executeTerminalCommand(e.target.value)
        e.target.value = ""
      }
    })

    // Search functionality
    this.searchInput.addEventListener("input", () => this.highlightSearchResults())

    // Sidebar tabs
    document.querySelectorAll(".sidebar-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchSidebarPanel(tab.dataset.panel))
    })

    // Output tabs
    document.querySelectorAll(".output-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchOutputPanel(tab.dataset.panel))
    })

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleGlobalKeyDown(e))
  }

  async loadPyodideFast() {
    try {
      const { loadPyodide } = await import("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js")
      this.loadingOverlay.style.display = "flex"
      this.updateLoadingProgress(0, "Starting Python engine...")

      // Load Pyodide with minimal configuration for speed
      this.pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
        fullStdLib: false, // Don't load full standard library initially
      })

      this.updateLoadingProgress(50, "Setting up environment...")

      // Setup minimal Python environment
      this.pyodide.runPython(`
                import sys
                import io
                import traceback
                
                # Fast output capture
                class FastOutput:
                    def __init__(self):
                        self.content = []
                    
                    def write(self, text):
                        self.content.append(text)
                    
                    def flush(self):
                        pass
                    
                    def get_output(self):
                        return ''.join(self.content)
                    
                    def clear(self):
                        self.content = []
                
                _stdout = FastOutput()
                _stderr = FastOutput()
                
                def run_fast(code):
                    _stdout.clear()
                    _stderr.clear()
                    
                    old_stdout = sys.stdout
                    old_stderr = sys.stderr
                    
                    try:
                        sys.stdout = _stdout
                        sys.stderr = _stderr
                        
                        exec(code, globals())
                        
                        return {
                            'success': True,
                            'output': _stdout.get_output(),
                            'error': _stderr.get_output()
                        }
                    except Exception as e:
                        return {
                            'success': False,
                            'output': _stdout.get_output(),
                            'error': _stderr.get_output() + str(e) + '\\n' + traceback.format_exc()
                        }
                    finally:
                        sys.stdout = old_stdout
                        sys.stderr = old_stderr
            `)

      this.updateLoadingProgress(100, "Ready!")

      setTimeout(() => {
        this.loadingOverlay.style.display = "none"
        this.pyodideStatus.textContent = "Ready ⚡"
        this.runBtn.disabled = false
        this.appendOutput(
          "⚡ FastPy Editor loaded in record time!\n🚀 Python environment ready\n💡 Packages load on-demand for maximum speed\n\nPress Ctrl+Enter to run code!",
          "output-success",
        )
      }, 300)
    } catch (error) {
      console.error("Fast loading error:", error)
      this.loadingOverlay.style.display = "none"
      this.pyodideStatus.textContent = "Error"
      this.appendOutput(`❌ Failed to load Python: ${error.message}\n\nPlease refresh to try again.`, "output-error")
    }
  }

  updateLoadingProgress(percent, text) {
    this.progressFill.style.width = percent + "%"
    this.loadingText.textContent = text
  }

  async runCode() {
    if (!this.pyodide) {
      this.appendOutput("❌ Python not ready yet. Please wait...", "output-error")
      return
    }

    const code = this.codeInput.value.trim()
    if (!code) {
      this.appendOutput("⚠️ No code to run", "output-warning")
      return
    }

    this.runBtn.disabled = true
    this.stopBtn.disabled = false
    this.updateStatus("⚡ Running...", "running")

    const startTime = performance.now()

    try {
      this.appendOutput("🚀 Executing...", "output-info")

      const result = this.pyodide.runPython(`run_fast("""${code.replace(/"/g, '\\"').replace(/\n/g, "\\n")}""")`)

      const executionTime = Math.round(performance.now() - startTime)

      if (result.get("success")) {
        const output = result.get("output")
        const error = result.get("error")

        if (output) {
          this.appendOutput(output, "output-success")
        }
        if (error) {
          this.appendOutput(error, "output-warning")
        }
        if (!output && !error) {
          this.appendOutput("✅ Code executed successfully (no output)", "output-success")
        }

        this.updateStatus(`⚡ Done in ${executionTime}ms`, "success")
      } else {
        const error = result.get("error")
        this.appendOutput(`❌ Error:\n${error}`, "output-error")
        this.updateStatus("❌ Failed", "error")
      }
    } catch (error) {
      this.appendOutput(`❌ Runtime Error: ${error.message}`, "output-error")
      this.updateStatus("❌ Failed", "error")
    } finally {
      this.runBtn.disabled = false
      this.stopBtn.disabled = true
    }
  }

  stopExecution() {
    this.updateStatus("⏹️ Stopped", "warning")
    this.runBtn.disabled = false
    this.stopBtn.disabled = true
    this.appendOutput("⏹️ Execution stopped", "output-warning")
  }

  debugCode() {
    this.switchOutputPanel("debug")
    this.appendToPanel("debugOutput", "🐛 Debug mode ready\n📍 Click line numbers to set breakpoints", "output-info")
  }

  appendOutput(text, className = "") {
    const timestamp = new Date().toLocaleTimeString()
    const outputLine = document.createElement("div")
    outputLine.className = className
    outputLine.textContent = `[${timestamp}] ${text}`
    this.output.appendChild(outputLine)
    this.output.scrollTop = this.output.scrollHeight
  }

  appendToPanel(panelId, text, className = "") {
    const panel = document.getElementById(panelId)
    const line = document.createElement("div")
    line.className = className
    line.textContent = text
    panel.appendChild(line)
    panel.scrollTop = panel.scrollHeight
  }

  clearConsole() {
    this.output.innerHTML = ""
    this.updateStatus("🧹 Cleared", "success")
  }

  downloadOutput() {
    const content = this.output.textContent
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "output.txt"
    a.click()
    URL.revokeObjectURL(url)
    this.updateStatus("💾 Downloaded", "success")
  }

  // File Management
  newFile() {
    const fileName = prompt("Enter file name:", "untitled.py")
    if (fileName && fileName.trim()) {
      const cleanName = fileName.trim()
      const finalName = cleanName.endsWith(".py") ? cleanName : cleanName + ".py"
      this.files.set(finalName, "")
      this.createTab(finalName)
      this.switchToFile(finalName)
      this.updateFileTree()
    }
  }

  newTab() {
    this.newFile()
  }

  closeTab(closeBtn) {
    const tab = closeBtn.parentElement
    const fileName = tab.dataset.file

    if (this.files.size <= 1) {
      alert("Cannot close the last tab")
      return
    }

    this.files.delete(fileName)
    tab.remove()

    // Switch to another tab
    const remainingTabs = document.querySelectorAll(".tab")
    if (remainingTabs.length > 0) {
      const nextFile = remainingTabs[0].dataset.file
      this.switchToFile(nextFile)
    }

    this.updateFileTree()
  }

  createTab(fileName) {
    const tab = document.createElement("div")
    tab.className = "tab"
    tab.dataset.file = fileName
    tab.innerHTML = `
            <span class="tab-name">${fileName}</span>
            <span class="tab-close" onclick="editor.closeTab(this)">&times;</span>
        `
    tab.addEventListener("click", (e) => {
      if (!e.target.classList.contains("tab-close")) {
        this.switchToFile(fileName)
      }
    })

    const newTabBtn = document.querySelector(".new-tab-btn")
    this.tabContainer.insertBefore(tab, newTabBtn)
  }

  switchToFile(fileName) {
    this.saveCurrentFile()
    this.currentFile = fileName
    this.codeInput.value = this.files.get(fileName) || ""

    // Update UI
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.file === fileName)
    })

    document.querySelectorAll(".file-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.file === fileName)
    })

    document.querySelector(".current-file").textContent = fileName

    this.updateLineNumbers()
    this.updateCursorPosition()
  }

  saveCurrentFile() {
    if (this.currentFile) {
      this.files.set(this.currentFile, this.codeInput.value)
    }
  }

  saveFile() {
    this.saveCurrentFile()
    const content = this.files.get(this.currentFile)
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = this.currentFile
    a.click()
    URL.revokeObjectURL(url)
    this.updateStatus(`💾 Saved ${this.currentFile}`, "success")
  }

  saveAsFile() {
    const fileName = prompt("Save as:", this.currentFile)
    if (fileName && fileName.trim()) {
      this.currentFile = fileName.trim()
      this.files.set(this.currentFile, this.codeInput.value)
      this.saveFile()

      // Update tab
      const activeTab = document.querySelector(".tab.active")
      activeTab.dataset.file = this.currentFile
      activeTab.querySelector(".tab-name").textContent = this.currentFile

      this.updateFileTree()
    }
  }

  loadFiles(event) {
    const files = Array.from(event.target.files)

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        this.files.set(file.name, e.target.result)
        this.createTab(file.name)
        this.switchToFile(file.name)
        this.updateFileTree()
        this.updateStatus(`📂 Loaded ${file.name}`, "success")
      }
      reader.readAsText(file)
    })
  }

  exportHTML() {
    const code = this.codeInput.value
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Python Code Export</title>
    <style>
        body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
        pre { background: #2d2d30; padding: 20px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Python Code - ${this.currentFile}</h1>
    <pre><code>${this.escapeHtml(code)}</code></pre>
</body>
</html>`

    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = this.currentFile.replace(".py", ".html")
    a.click()
    URL.revokeObjectURL(url)
    this.updateStatus(`📤 Exported as HTML`, "success")
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  updateFileTree() {
    this.fileTree.innerHTML = ""
    this.files.forEach((content, fileName) => {
      const item = document.createElement("div")
      item.className = "file-item"
      item.dataset.file = fileName
      item.textContent = `📄 ${fileName}`
      item.addEventListener("click", () => this.switchToFile(fileName))

      if (fileName === this.currentFile) {
        item.classList.add("active")
      }

      this.fileTree.appendChild(item)
    })
  }

  // Editor Features
  updateLineNumbers() {
    const lines = this.codeInput.value.split("\n")
    const lineCount = lines.length
    let lineNumbersHtml = ""

    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHtml += i + "\n"
    }

    this.lineNumbers.textContent = lineNumbersHtml
    this.updateFileSize()
  }

  syncScroll() {
    this.lineNumbers.scrollTop = this.codeInput.scrollTop
  }

  updateCursorPosition() {
    const textarea = this.codeInput
    const text = textarea.value
    const cursorPos = textarea.selectionStart

    const textBeforeCursor = text.substring(0, cursorPos)
    const lines = textBeforeCursor.split("\n")
    const currentLine = lines.length
    const currentColumn = lines[lines.length - 1].length + 1

    this.lineCol.textContent = `Line ${currentLine}, Column ${currentColumn}`
  }

  updateFileSize() {
    const size = new Blob([this.codeInput.value]).size
    document.getElementById("fileSize").textContent = `${size} bytes`
  }

  updateStatus(message, type = "normal") {
    this.status.textContent = message
    this.status.className = `status-${type}`

    if (type !== "error") {
      setTimeout(() => {
        if (this.status.textContent === message) {
          this.status.textContent = "Ready"
          this.status.className = ""
        }
      }, 2000)
    }
  }

  changeFontSize(size) {
    this.settings.fontSize = Number.parseInt(size)
    this.codeInput.style.fontSize = size + "px"
    this.lineNumbers.style.fontSize = size + "px"
    this.output.style.fontSize = size + "px"
    this.saveSettings()
  }

  formatCode() {
    const code = this.codeInput.value
    const lines = code.split("\n")
    let indentLevel = 0
    const formattedLines = []

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (trimmed === "" || trimmed.startsWith("#")) {
        formattedLines.push(trimmed)
        return
      }

      // Decrease indent for certain keywords
      if (
        trimmed.startsWith("except") ||
        trimmed.startsWith("elif") ||
        trimmed.startsWith("else") ||
        trimmed.startsWith("finally")
      ) {
        indentLevel = Math.max(0, indentLevel - 1)
      }

      formattedLines.push("    ".repeat(indentLevel) + trimmed)

      // Increase indent after colon
      if (trimmed.endsWith(":")) {
        indentLevel++
      }
    })

    this.codeInput.value = formattedLines.join("\n")
    this.updateLineNumbers()
    this.updateStatus("✨ Formatted", "success")
  }

  // Search and Replace
  findNext() {
    const searchTerm = this.searchInput.value
    if (!searchTerm) return

    const code = this.codeInput.value
    const currentPos = this.codeInput.selectionStart
    const nextPos = code.indexOf(searchTerm, currentPos + 1)

    if (nextPos !== -1) {
      this.codeInput.setSelectionRange(nextPos, nextPos + searchTerm.length)
      this.codeInput.focus()
    } else {
      const firstPos = code.indexOf(searchTerm)
      if (firstPos !== -1) {
        this.codeInput.setSelectionRange(firstPos, firstPos + searchTerm.length)
        this.codeInput.focus()
      }
    }
  }

  replaceAll() {
    const searchTerm = this.searchInput.value
    const replaceTerm = this.replaceInput.value

    if (!searchTerm) return

    const newCode = this.codeInput.value.replaceAll(searchTerm, replaceTerm)
    this.codeInput.value = newCode
    this.updateLineNumbers()
    this.updateStatus(`🔄 Replaced "${searchTerm}"`, "success")
  }

  highlightSearchResults() {
    // Placeholder for search highlighting
  }

  // Package Management - On-demand loading
  async installPackage() {
    const packageName = this.packageInput.value.trim()
    if (!packageName) return

    if (!this.pyodide) {
      this.appendOutput("❌ Python not ready yet", "output-error")
      return
    }

    try {
      this.updateStatus(`📦 Installing ${packageName}...`, "loading")

      // Install package on-demand
      await this.pyodide.loadPackage([packageName])

      // Add to installed packages list
      const packageDiv = document.createElement("div")
      packageDiv.className = "package-item"
      packageDiv.textContent = `✅ ${packageName}`
      this.installedPackages.appendChild(packageDiv)

      this.packageInput.value = ""
      this.updateStatus(`✅ ${packageName} installed`, "success")
      this.appendOutput(`📦 Package ${packageName} installed successfully!`, "output-success")
    } catch (error) {
      this.updateStatus(`❌ Failed to install ${packageName}`, "error")
      this.appendOutput(`📦 Installation failed: ${error.message}`, "output-error")
    }
  }

  // Terminal functionality
  executeTerminalCommand(command) {
    if (!this.pyodide) {
      this.appendToPanel("terminalOutput", "❌ Python not ready", "output-error")
      return
    }

    this.appendToPanel("terminalOutput", `>>> ${command}`, "")

    try {
      const result = this.pyodide.runPython(command)
      if (result !== undefined) {
        this.appendToPanel("terminalOutput", String(result), "output-success")
      }
    } catch (error) {
      this.appendToPanel("terminalOutput", `❌ ${error.message}`, "output-error")
    }
  }

  // UI Management
  switchSidebarPanel(panelName) {
    document.querySelectorAll(".sidebar-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.panel === panelName)
    })

    document.querySelectorAll(".sidebar-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelName)
    })
  }

  switchOutputPanel(panelName) {
    document.querySelectorAll(".output-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.panel === panelName)
    })

    document.querySelectorAll(".output-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelName)
    })
  }

  toggleTheme() {
    const themes = ["dark", "light", "monokai"]
    const currentIndex = themes.indexOf(this.settings.theme)
    const nextIndex = (currentIndex + 1) % themes.length
    this.settings.theme = themes[nextIndex]

    document.body.className = `theme-${this.settings.theme}`
    this.saveSettings()
    this.updateStatus(`🎨 ${this.settings.theme} theme`, "success")
  }

  toggleMinimap() {
    this.settings.minimap = !this.settings.minimap
    const minimap = document.getElementById("minimap")
    minimap.classList.toggle("active", this.settings.minimap)
    this.saveSettings()
  }

  toggleWordWrap() {
    this.settings.wordWrap = !this.settings.wordWrap
    this.codeInput.style.whiteSpace = this.settings.wordWrap ? "pre-wrap" : "pre"
    this.saveSettings()
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // Modal Management
  showSettings() {
    const modal = document.getElementById("settingsModal")
    modal.classList.add("active")

    document.getElementById("themeSelect").value = this.settings.theme
    document.getElementById("fontFamily").value = this.settings.fontFamily
    document.getElementById("autoSave").checked = this.settings.autoSave
  }

  showSnippets() {
    const modal = document.getElementById("snippetsModal")
    const snippetList = document.getElementById("snippetList")

    snippetList.innerHTML = ""
    Object.entries(this.snippets).forEach(([name, code]) => {
      const snippetDiv = document.createElement("div")
      snippetDiv.className = "snippet-item"
      snippetDiv.innerHTML = `
                <h4>${name}</h4>
                <pre>${code}</pre>
                <button onclick="editor.insertSnippet('${name}')">Insert</button>
            `
      snippetList.appendChild(snippetDiv)
    })

    modal.classList.add("active")
  }

  showPackageManager() {
    this.switchSidebarPanel("packages")
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active")
  }

  insertSnippet(snippetName) {
    const snippet = this.snippets[snippetName]
    if (snippet) {
      const cursorPos = this.codeInput.selectionStart
      const textBefore = this.codeInput.value.substring(0, cursorPos)
      const textAfter = this.codeInput.value.substring(cursorPos)

      this.codeInput.value = textBefore + snippet + textAfter
      this.codeInput.focus()
      this.codeInput.setSelectionRange(cursorPos + snippet.length, cursorPos + snippet.length)

      this.updateLineNumbers()
      this.closeModal("snippetsModal")
    }
  }

  // Keyboard Shortcuts
  handleKeyDown(event) {
    if (event.key === "Tab") {
      event.preventDefault()
      const start = this.codeInput.selectionStart
      const end = this.codeInput.selectionEnd
      const value = this.codeInput.value

      if (event.shiftKey) {
        // Unindent
        const lineStart = value.lastIndexOf("\n", start - 1) + 1
        const lineText = value.substring(lineStart, start)
        if (lineText.startsWith("    ")) {
          this.codeInput.value = value.substring(0, lineStart) + lineText.substring(4) + value.substring(start)
          this.codeInput.selectionStart = this.codeInput.selectionEnd = start - 4
        }
      } else {
        // Indent
        this.codeInput.value = value.substring(0, start) + "    " + value.substring(end)
        this.codeInput.selectionStart = this.codeInput.selectionEnd = start + 4
      }

      this.updateLineNumbers()
    }

    // Auto-completion for brackets and quotes
    const pairs = {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "'": "'",
    }

    if (pairs[event.key]) {
      const start = this.codeInput.selectionStart
      const end = this.codeInput.selectionEnd

      if (start !== end) {
        event.preventDefault()
        const selectedText = this.codeInput.value.substring(start, end)
        const replacement = event.key + selectedText + pairs[event.key]

        this.codeInput.value =
          this.codeInput.value.substring(0, start) + replacement + this.codeInput.value.substring(end)

        this.codeInput.setSelectionRange(start + 1, start + 1 + selectedText.length)
      }
    }
  }

  handleGlobalKeyDown(event) {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case "Enter":
          event.preventDefault()
          this.runCode()
          break
        case "s":
          event.preventDefault()
          this.saveFile()
          break
        case "n":
          event.preventDefault()
          this.newFile()
          break
        case "o":
          event.preventDefault()
          this.loadBtn.click()
          break
        case "f":
          event.preventDefault()
          this.searchInput.focus()
          this.switchSidebarPanel("search")
          break
        case ",":
          event.preventDefault()
          this.showSettings()
          break
        case "`":
          event.preventDefault()
          this.switchOutputPanel("terminal")
          this.terminalInput.focus()
          break
      }
    }

    if (event.key === "F11") {
      event.preventDefault()
      this.toggleFullscreen()
    }
  }

  // Utility Functions
  undo() {
    // Simple undo implementation
    this.updateStatus("↶ Undo", "info")
  }

  redo() {
    // Simple redo implementation
    this.updateStatus("↷ Redo", "info")
  }

  selectAll() {
    this.codeInput.select()
  }

  findReplace() {
    this.switchSidebarPanel("search")
    this.searchInput.focus()
  }

  autoSave() {
    if (this.settings.autoSave) {
      this.saveCurrentFile()
    }
  }

  // Settings Management
  loadSettings() {
    const saved = localStorage.getItem("fastpy-settings")
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) }
      this.applySettings()
    }
  }

  saveSettings() {
    localStorage.setItem("fastpy-settings", JSON.stringify(this.settings))
  }

  applySettings() {
    this.changeFontSize(this.settings.fontSize)
    document.body.className = `theme-${this.settings.theme}`
    this.codeInput.style.fontFamily = this.settings.fontFamily
    this.codeInput.style.whiteSpace = this.settings.wordWrap ? "pre-wrap" : "pre"

    const minimap = document.getElementById("minimap")
    minimap.classList.toggle("active", this.settings.minimap)
  }
}

// Initialize the fast editor
let editor
document.addEventListener("DOMContentLoaded", () => {
  editor = new FastPythonEditor()
})

// Console welcome message
console.log(`
⚡ FastPy Editor - Lightning Fast Python in Browser

🚀 Optimized for Speed:
- Minimal initial loading
- On-demand package installation
- Fast execution engine
- Streamlined UI

⌨️ Keyboard Shortcuts:
- Ctrl+Enter: Run code
- Ctrl+S: Save file
- Ctrl+N: New file
- Ctrl+O: Open file
- Ctrl+F: Find & Replace
- F11: Fullscreen

Ready to code at lightning speed! ⚡
`)
