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
                
                li.innerHTML = `
                    <div class="file-info" title="Doble clic para abrir">
                        <i class="icon">${file.name.endsWith('.js') ? '📜' : '📝'}</i>
                        <span class="name-text">${file.name}</span>
                    </div>
                    <button class="delete-btn" title="Eliminar">&times;</button>
                `;

                // Toda la fila (li) responde al clic
                li.onclick = (e) => {
                    document.querySelectorAll('.file-item').forEach(item => item.classList.remove('active'));
                    li.classList.add('active');
                };

                // Toda la fila (li) responde al doble clic
                li.ondblclick = (e) => {
                    // Evitar que abra si se hace doble clic sobre el botón de borrar
                    if (!e.target.classList.contains('delete-btn')) {
                        App.handleOpenFile(file.path, file.name);
                    }
                };

                li.querySelector('.delete-btn').onclick = (e) => {
                    e.stopPropagation(); // Evita que se dispare li.onclick
                    App.handleDeleteFile(file.path);
                };

                container.appendChild(li);
            });
        };

        render(data.sourceFiles, this.elements.sourceList);
        render(data.scriptFiles, this.elements.scriptList);
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
        const data = await API.fetchFiles();
        UI.renderFileList(data);
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
