/**
 * Virtual FS Studio - Modular Frontend with Monaco Editor
 */

// --- CONFIGURACIÓN DE LIBRERÍAS ---
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true
});

let editor; // Instancia de Monaco Editor

// --- MÓDULO DE ESTADO ---
const State = {
    currentPath: null,
    currentName: null,
    files: { source: [], script: [] },
    workingFiles: [],
    
    setActive(path, name) {
        this.currentPath = path;
        this.currentName = name;
    }
};

// --- MÓDULO DE API ---
const API = {
    async fetchFiles() {
        const res = await fetch('/api/files');
        return await res.json();
    },
    async fetchWorkingFiles(subDir = '') {
        const res = await fetch(`/api/working-files?subDir=${encodeURIComponent(subDir)}`);
        return await res.json();
    },
    async fetchFileContent(path) {
        const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
        return await res.json();
    },
    async saveFile(path, content) {
        return await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        });
    },
    async createFile(category, name) {
        return await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, name })
        });
    },
    async deleteFile(path) {
        return await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
    },
    async fetchProcessedView(name) {
        const res = await fetch(`/api/view?name=${encodeURIComponent(name)}`);
        return await res.json();
    }
};

// --- MÓDULO DE UI ---
const UI = {
    elements: {
        sourceList: document.getElementById('source-list'),
        scriptList: document.getElementById('script-list'),
        workingList: document.getElementById('working-list'),
        preview: document.getElementById('preview-content'),
        filename: document.getElementById('current-filename'),
        saveBtn: document.getElementById('save-btn'),
        resizer: document.getElementById('resizer'),
        editorLang: document.getElementById('editor-language'),
        editorPos: document.getElementById('editor-pos')
    },

    initMonaco() {
        return new Promise((resolve) => {
            require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
            require(['vs/editor/editor.main'], () => {
                editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
                    value: '',
                    language: 'markdown',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible'
                    }
                });

                // Escuchar cambios de posición del cursor
                editor.onDidChangeCursorPosition((e) => {
                    this.elements.editorPos.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                });

                // --- AUTOCOMPLETADO ESTILO OBSIDIAN [[ ---
                try {
                    const obsidianProvider = {
                        triggerCharacters: ['[', '/'],
                        provideCompletionItems: async (model, position) => {
                            const textUntilPosition = model.getValueInRange({
                                startLineNumber: position.lineNumber,
                                startColumn: 1,
                                endLineNumber: position.lineNumber,
                                endColumn: position.column
                            });

                            const match = textUntilPosition.match(/\[\[([^\]]*)$/);
                            if (!match) return { suggestions: [] };

                            const fullQuery = match[1];
                            const lastSlashIndex = fullQuery.lastIndexOf('/');
                            const currentDir = lastSlashIndex !== -1 ? fullQuery.substring(0, lastSlashIndex) : '';
                            const fileNameQuery = lastSlashIndex !== -1 ? fullQuery.substring(lastSlashIndex + 1) : fullQuery;

                            try {
                                const files = await API.fetchWorkingFiles(currentDir);
                                
                                // Verificar si ya hay corchetes de cierre justo después del cursor
                                const lineContent = model.getLineContent(position.lineNumber);
                                const textAfterCursor = lineContent.substring(position.column - 1);
                                const hasClosingBrackets = textAfterCursor.startsWith(']]');

                                const suggestions = files.map(file => {
                                    const isDir = file.type === 'dir';
                                    const suffix = isDir ? '/' : (hasClosingBrackets ? '' : ']]');

                                    return {
                                        label: file.name,
                                        kind: isDir ? monaco.languages.CompletionItemKind.Folder : monaco.languages.CompletionItemKind.File,
                                        insertText: file.name + suffix,
                                        detail: isDir ? 'Carpeta' : 'Archivo',
                                        filterText: file.name,
                                        range: {
                                            startLineNumber: position.lineNumber,
                                            endLineNumber: position.lineNumber,
                                            startColumn: position.column - fileNameQuery.length,
                                            endColumn: position.column
                                        },
                                        command: isDir ? { id: 'editor.action.triggerSuggest', title: 'Sugerir' } : null
                                    };
                                });
                                return { suggestions };
                            } catch (e) {
                                return { suggestions: [] };
                            }
                        }
                    };

                    monaco.languages.registerCompletionItemProvider('markdown', obsidianProvider);
                    monaco.languages.registerCompletionItemProvider('javascript', obsidianProvider);
                    monaco.languages.registerCompletionItemProvider('json', obsidianProvider);
                } catch (err) {
                    console.error("Error al registrar CompletionProvider:", err);
                }

                // --- NAVEGACIÓN POR LINKS [[ ---
                try {
                    const linkProvider = {
                        provideLinks: (model) => {
                            const links = [];
                            const text = model.getValue();
                            const regex = /\[\[([^\]]+)\]\]/g;
                            let match;

                            while ((match = regex.exec(text)) !== null) {
                                const fileName = match[1];
                                const startPos = model.getPositionAt(match.index);
                                const endPos = model.getPositionAt(match.index + match[0].length);
                                
                                let targetPath = null;
                                const inSource = State.files.source.find(f => f.name === fileName);
                                const inScript = State.files.script.find(f => f.name === fileName);
                                const inWorking = State.workingFiles.find(f => f.name === fileName);
                                
                                if (fileName.includes('/')) {
                                    targetPath = fileName;
                                } else if (inSource) {
                                    targetPath = inSource.path;
                                } else if (inScript) {
                                    targetPath = inScript.path;
                                } else if (inWorking) {
                                    targetPath = inWorking.path;
                                }

                                if (targetPath) {
                                    links.push({
                                        range: new monaco.Range(
                                            startPos.lineNumber, startPos.column,
                                            endPos.lineNumber, endPos.column
                                        ),
                                        url: `command:openVirtualFile?${encodeURIComponent(JSON.stringify({ path: targetPath, name: fileName }))}`,
                                        tooltip: `Ir a ${fileName}`
                                    });
                                }
                            }
                            return { links };
                        }
                    };

                    monaco.languages.registerLinkProvider('markdown', linkProvider);
                    monaco.languages.registerLinkProvider('javascript', linkProvider);

                    // Registrar el comando para abrir el archivo
                    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyG, () => {}, 'openVirtualFile');

                    // Interceptar clics de forma más segura
                    const instService = editor._instantiationService || editor._getService(monaco.editor.IInstantiationService);
                    if (instService) {
                        const openerService = instService._services.get(monaco.editor.IOpenerService);
                        if (openerService) {
                            const originalOpen = openerService.open.bind(openerService);
                            openerService.open = async (target, options) => {
                                if (typeof target === 'string' && target.startsWith('command:openVirtualFile?')) {
                                    const params = JSON.parse(decodeURIComponent(target.split('?')[1]));
                                    App.handleOpenFile(params.path, params.name);
                                    return true;
                                }
                                return originalOpen(target, options);
                            };
                        }
                    }
                } catch (err) {
                    console.error("Error al configurar LinkProvider/OpenerService:", err);
                }

                resolve();
            });
        });
    },

    initResizer() {
        let isResizing = false;
        const container = document.querySelector('.main-container');
        const editorArea = document.querySelector('.editor-area');

        this.elements.resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            // Evitar que el editor capture eventos mientras arrastramos
            document.body.style.pointerEvents = 'none';
            this.elements.resizer.style.pointerEvents = 'auto';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const containerRect = container.getBoundingClientRect();
            const sidebarWidth = document.querySelector('.sidebar').offsetWidth;
            const newEditorWidth = e.clientX - containerRect.left - sidebarWidth;
            
            if (newEditorWidth > 200 && (containerRect.width - newEditorWidth - sidebarWidth) > 200) {
                editorArea.style.flex = 'none';
                editorArea.style.width = `${newEditorWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.pointerEvents = 'auto';
            }
        });
    },

    renderFileList(data) {
        const render = (files, container) => {
            container.innerHTML = '';
            files.forEach(file => {
                const li = document.createElement('li');
                li.className = `file-item ${State.currentPath === file.path ? 'active' : ''}`;
                
                let icon = '📝';
                if (file.type === 'dir') icon = '📁';
                else if (file.name.endsWith('.js')) icon = '📜';
                else if (file.name.endsWith('.json')) icon = '📦';

                li.innerHTML = `
                    <div class="file-info" title="${file.path}">
                        <i class="icon">${icon}</i>
                        <span class="name-text">${file.name}</span>
                    </div>
                    ${file.type !== 'dir' ? '<button class="delete-btn" title="Eliminar">&times;</button>' : ''}
                `;

                li.onclick = () => {
                    document.querySelectorAll('.file-item').forEach(item => item.classList.remove('active'));
                    li.classList.add('active');
                };

                li.ondblclick = (e) => {
                    if (!e.target.classList.contains('delete-btn') && file.type !== 'dir') {
                        App.handleOpenFile(file.path, file.name);
                    }
                };

                const delBtn = li.querySelector('.delete-btn');
                if (delBtn) {
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        App.handleDeleteFile(file.path);
                    };
                }

                container.appendChild(li);
            });
        };

        render(data.sourceFiles, this.elements.sourceList);
        render(data.scriptFiles, this.elements.scriptList);
        render(data.workingFiles, this.elements.workingList);
    },

    updateEditor(content, name) {
        const extension = name.split('.').pop();
        let language = 'markdown';
        if (extension === 'js') language = 'javascript';
        if (extension === 'json') language = 'json';

        monaco.editor.setModelLanguage(editor.getModel(), language);
        this.elements.editorLang.textContent = language;
        editor.setValue(content);
        this.elements.filename.textContent = name;
    },

    renderPreview(content, isMarkdown) {
        if (isMarkdown) {
            this.elements.preview.innerHTML = marked.parse(content);
            this.elements.preview.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            this.elements.preview.innerHTML = `<pre class="plain-text"><code>${content}</code></pre>`;
            if (this.elements.preview.querySelector('code')) {
                hljs.highlightElement(this.elements.preview.querySelector('code'));
            }
        }
    },

    setLoading(isLoading, message = "Procesando...") {
        if (isLoading) {
            this.elements.preview.innerHTML = `<div class="loading">${message}</div>`;
        }
    }
};

// --- ORQUESTADOR PRINCIPAL (APP) ---
const App = {
    async init() {
        await UI.initMonaco();
        UI.initResizer();
        this.bindEvents();
        await this.refreshFiles();
    },

    bindEvents() {
        UI.elements.saveBtn.onclick = () => this.handleSave();
        
        // Atajo de teclado dentro de Monaco
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            this.handleSave();
        });
    },

    async refreshFiles() {
        try {
            const [data, workingData] = await Promise.all([
                API.fetchFiles().catch(err => {
                    console.error("Error fetching main files:", err);
                    return { sourceFiles: [], scriptFiles: [] };
                }),
                API.fetchWorkingFiles().catch(err => {
                    console.error("Error fetching working files:", err);
                    return [];
                })
            ]);
            
            State.files.source = data.sourceFiles || [];
            State.files.script = data.scriptFiles || [];
            State.workingFiles = Array.isArray(workingData) ? workingData : [];
            
            UI.renderFileList(data);
        } catch (err) {
            console.error("Critical error in refreshFiles:", err);
        }
    },

    async handleOpenFile(path, name) {
        State.setActive(path, name);
        this.refreshFiles();

        const data = await API.fetchFileContent(path);
        UI.updateEditor(data.content, name);

        if (name.endsWith('.txt') || name.endsWith('.md')) {
            this.updateLivePreview();
        } else {
            UI.elements.preview.innerHTML = '<div class="empty-state">Vista previa no disponible</div>';
        }
    },

    async handleSave() {
        if (!State.currentPath) return;
        
        const content = editor.getValue();
        const btn = UI.elements.saveBtn;
        
        btn.textContent = 'Guardando...';
        btn.disabled = true;

        const res = await API.saveFile(State.currentPath, content);
        
        if (res.ok) {
            setTimeout(() => {
                btn.textContent = 'Guardar (Ctrl+S)';
                btn.disabled = false;
                if (State.currentName.endsWith('.txt') || State.currentName.endsWith('.md')) {
                    this.updateLivePreview();
                }
            }, 300);
        }
    },

    async handleCreateFile(category) {
        const name = prompt(`Nuevo archivo en ${category}:`);
        if (!name) return;

        const res = await API.createFile(category, name);
        if (res.ok) {
            await this.refreshFiles();
            const dir = category === 'source' ? 'textos' : 'scripts';
            this.handleOpenFile(`${dir}/${name}`, name);
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    },

    async handleDeleteFile(path) {
        if (!confirm(`¿Eliminar ${path}?`)) return;

        const res = await API.deleteFile(path);
        if (res.ok) {
            if (State.currentPath === path) {
                State.setActive(null, null);
                UI.updateEditor('', 'Selecciona un archivo');
                UI.elements.preview.innerHTML = '';
            }
            this.refreshFiles();
        }
    },

    async updateLivePreview() {
        UI.setLoading(true);
        try {
            const data = await API.fetchProcessedView(State.currentName);
            UI.renderPreview(data.content, State.currentName.endsWith('.md'));
        } catch (err) {
            UI.elements.preview.innerHTML = '<div class="error">Error al procesar vista previa virtual</div>';
        }
    }
};

window.createNewFile = (cat) => App.handleCreateFile(cat);
App.init();
