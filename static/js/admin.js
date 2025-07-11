// Admin interface JavaScript for dynamic form management

class AdminInterface {
    constructor() {
        this.currentTab = 'guias';
        this.config = {};
        this.init();
    }

    init() {
        this.loadConfiguration();
        this.setupEventListeners();
        this.showTab('clientes');
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.showTab(tabName);
            });
        });

        // Add question button (centralized)
        document.getElementById('addQuestionBtn').addEventListener('click', () => {
            this.addQuestion(this.currentTab);
        });

        // Save configuration
        document.getElementById('saveConfig').addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Refresh forms
        document.getElementById('refreshForms').addEventListener('click', () => {
            this.loadForms();
        });

        // Dynamic input changes
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('config-input')) {
                this.updateConfigFromInput(e.target);
            }
        });
    }

    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.config-form').forEach(form => {
            form.classList.remove('active');
        });
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`${tabName}-config`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        this.currentTab = tabName;

        if (tabName === 'forms') {
            this.loadForms();
        } else {
            this.renderQuestions(tabName);
        }
    }

    async loadConfiguration() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.config = await response.json();
                this.populateConfigInputs();
            } else {
                console.error('Failed to load configuration');
                this.showNotification('Erro ao carregar configuração', 'error');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.showNotification('Erro de conexão', 'error');
        }
    }

    populateConfigInputs() {
        ['guias', 'clientes', 'fornecedores'].forEach(formType => {
            const config = this.config[formType] || {};

            // Populate board inputs
            const boardAInput = document.getElementById(`${formType}-board-a`);
            const boardBInput = document.getElementById(`${formType}-board-b`);
            const linkColumnInput = document.getElementById(`${formType}-link-column`);

            if (boardAInput) boardAInput.value = config.board_a || '';
            if (boardBInput) boardBInput.value = config.board_b || '';
            if (linkColumnInput) linkColumnInput.value = config.link_column || '';

            // Populate header fields
            const headerFields = config.header_fields || [];
            for (let i = 0; i < 4; i++) {
                const titleInput = document.getElementById(`${formType}-header-${i + 1}-title`);
                const columnInput = document.getElementById(`${formType}-header-${i + 1}-column`);

                if (titleInput) titleInput.value = headerFields[i]?.title || '';
                if (columnInput) columnInput.value = headerFields[i]?.monday_column || '';
            }

            // Populate questions title
            const questionsTitleInput = document.getElementById(`${formType}-questions-title`);
            if (questionsTitleInput) questionsTitleInput.value = config.questions_title || 'Perguntas';
        });

        this.renderQuestions(this.currentTab);
    }

    renderQuestions(formType) {
        const questionsContainer = document.getElementById(`${formType}-questions`);
        if (!questionsContainer) return;

        const questions = this.config[formType]?.questions || [];

        questionsContainer.innerHTML = '';

        questions.forEach((item, index) => {
            if (item.type === 'divider') {
                const dividerElement = this.createDividerElement(formType, item.title, index);
                questionsContainer.appendChild(dividerElement);
            } else {
                const questionElement = this.createQuestionElement(item, index, formType);
                questionsContainer.appendChild(questionElement);
            }

            // Add divider line after each item (except the last one)
            if (index < questions.length - 1) {
                const dividerLine = this.createDividerLine(formType, index);
                questionsContainer.appendChild(dividerLine);
            }
        });

        // Add a final divider line if there are questions (for adding new ones)
        if (questions.length > 0) {
            const finalDividerLine = this.createDividerLine(formType, questions.length - 1);
            questionsContainer.appendChild(finalDividerLine);
        }

        // Refresh feather icons
        setTimeout(() => {
            feather.replace();
        }, 0);
    }

    createQuestionElement(question, index, formType) {
        // Calculate question number excluding dividers
        const questionNumber = this.getQuestionNumber(formType, index);

        const div = document.createElement('div');
        div.className = 'question-item';
        div.innerHTML = `
            <div class="question-header">
                <h4>Pergunta ${questionNumber}</h4>
                <div class="question-actions">
                    <button type="button" class="btn btn-outline-secondary btn-sm me-1" 
                            onclick="adminInterface.moveItem('${formType}', ${index}, 'up')"
                            ${index === 0 ? 'disabled' : ''}>
                        <i data-feather="chevron-up"></i>
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" 
                            onclick="adminInterface.moveItem('${formType}', ${index}, 'down')"
                            ${index === (this.config[formType]?.questions?.length - 1) ? 'disabled' : ''}>
                        <i data-feather="chevron-down"></i>
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" 
                            onclick="adminInterface.removeQuestion(this, '${formType}')">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label class="form-label">Texto da pergunta:</label>
                        <input type="text" class="form-control config-input" 
                               data-path="${formType}.questions.${index}.text"
                               value="${question.text || ''}" 
                               placeholder="Digite o texto da pergunta"
                               ${question.type === 'monday_column' ? 'readonly' : ''}>
                        ${question.type === 'monday_column' ? '<small class="text-muted">Para perguntas do tipo "Coluna do Monday", o título será automaticamente o valor da coluna</small>' : ''}
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="form-group">
                        <label class="form-label">Tipo:</label>
                        <select class="form-control config-input" 
                                data-path="${formType}.questions.${index}.type"
                                onchange="adminInterface.toggleQuestionFields('${formType}', ${index}, this.value)">
                            <option value="yesno" ${question.type === 'yesno' ? 'selected' : ''}>Sim/Não</option>
                            <option value="rating" ${question.type === 'rating' ? 'selected' : ''}>Nota 1-10</option>
                            <option value="text" ${question.type === 'text' ? 'selected' : ''}>Texto</option>
                            <option value="longtext" ${question.type === 'longtext' ? 'selected' : ''}>Texto Longo</option>
                            <option value="dropdown" ${question.type === 'dropdown' ? 'selected' : ''}>Lista Suspensa</option>
                            <option value="monday_column" ${question.type === 'monday_column' ? 'selected' : ''}>Coluna do Monday</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="form-group">
                        <label class="form-label">Obrigatória:</label>
                        <select class="form-control config-input" 
                                data-path="${formType}.questions.${index}.required">
                            <option value="true" ${question.required ? 'selected' : ''}>Sim</option>
                            <option value="false" ${!question.required ? 'selected' : ''}>Não</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="form-group">
                        <label class="form-label">ID da pergunta:</label>
                        <input type="text" class="form-control config-input" 
                               data-path="${formType}.questions.${index}.id"
                               value="${question.id || ''}" 
                               placeholder="id_da_pergunta">
                    </div>
                </div>
                <div class="col-md-4" id="source-column-${formType}-${index}" style="display: ${question.type === 'monday_column' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label class="form-label">Coluna Origem (Quadro A):</label>
                        <input type="text" class="form-control config-input" 
                               data-path="${formType}.questions.${index}.source_column"
                               value="${question.source_column || ''}" 
                               placeholder="ID da coluna no Quadro A">
                    </div>
                </div>
                <div class="col-md-4" id="dropdown-options-${formType}-${index}" style="display: ${question.type === 'dropdown' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label class="form-label">Opções da Lista:</label>
                        <input type="text" class="form-control config-input" 
                               data-path="${formType}.questions.${index}.dropdown_options"
                               value="${question.dropdown_options || ''}" 
                               placeholder="Opção1;Opção2;Opção3">
                        <small class="form-text text-muted">Separe as opções com ponto e vírgula (;)</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="form-group">
                        <label class="form-label">Coluna Destino:</label>
                        <input type="text" class="form-control config-input" 
                               data-path="${formType}.questions.${index}.destination_column"
                               value="${question.destination_column || ''}" 
                               placeholder="ID da coluna no Quadro B">
                    </div>
                </div>
            </div>
            <div class="row" id="question-destino-row-${formType}-${index}" style="display: ${question.type === 'monday_column' ? 'block' : 'none'};">
                <div class="col-md-4">
                    <div class="form-group">
                        <label class="form-label">Coluna Destino Pergunta:</label>
                        <input type="text" class="form-control config-input" 
                               data-path="${formType}.questions.${index}.question_destination_column"
                               value="${question.question_destination_column || ''}" 
                               placeholder="ID da coluna para valor da pergunta">
                        <small class="form-text text-muted">Coluna onde será salvo o valor da Coluna Origem</small>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="form-group">
                        <label class="form-label">Observação:</label>
                        <p class="form-text text-muted">
                            <strong>Coluna Destino:</strong> Para a resposta da avaliação (1-10)<br>
                            <strong>Coluna Destino Pergunta:</strong> Para o valor da coluna origem (texto da pergunta)
                        </p>
                    </div>
                </div></div>
<div class="row">
            </div>
            <div class="mt-3">
                <div class="form-check">
                    <input class="form-check-input config-input" type="checkbox" 
                           data-path="${formType}.questions.${index}.is_conditional"
                           ${question.conditional ? 'checked' : ''} 
                           onchange="adminInterface.toggleConditionalFields('${formType}', ${index}, this.checked)">
                    <label class="form-check-label">
                        Pergunta condicional
                    </label>
                </div>
                <div id="conditional-fields-${formType}-${index}" class="conditional-fields mt-2" 
                     style="display: ${question.conditional ? 'block' : 'none'};">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label class="form-label">Depende da pergunta:</label>
                                <select class="form-control config-input" 
                                        data-path="${formType}.questions.${index}.conditional.depends_on">
                                    <option value="">Selecione...</option>
                                    ${this.getQuestionOptions(formType, index, question.conditional?.depends_on)}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label class="form-label">Mostrar se resposta for:</label>
                                <select class="form-control config-input" 
                                        data-path="${formType}.questions.${index}.conditional.show_if">
                                    <option value="yes" ${!question.conditional?.show_if || question.conditional?.show_if === 'yes' ? 'selected' : ''}>Sim</option>
                                    <option value="no" ${question.conditional?.show_if === 'no' ? 'selected' : ''}>Não</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for dynamic fields
        const typeSelect = div.querySelector(`select[data-path="${formType}.questions.${index}.type"]`);
        if (typeSelect) {
            typeSelect.addEventListener('change', function() {
                const sourceColumnDiv = document.getElementById(`source-column-${formType}-${index}`);
                const destinationColumnDiv = document.getElementById(`destination-column-${formType}-${index}`);
                const dropdownOptionsDiv = document.getElementById(`dropdown-options-${formType}-${index}`);
                const conditionalDiv = document.getElementById(`conditional-${formType}-${index}`);
                const textInput = div.querySelector(`input[data-path="${formType}.questions.${index}.text"]`);
                const textLabel = div.querySelector('.form-label');

                if (sourceColumnDiv) {
                    sourceColumnDiv.style.display = this.value === 'monday_column' ? 'block' : 'none';
                }
                if (destinationColumnDiv) {
                    destinationColumnDiv.style.display = this.value === 'monday_column' ? 'none' : 'block';
                }
                if (dropdownOptionsDiv) {
                    dropdownOptionsDiv.style.display = this.value === 'dropdown' ? 'block' : 'none';
                }
                if (conditionalDiv) {
                    conditionalDiv.style.display = this.value === 'yesno' ? 'block' : 'none';
                }
                
                // Handle question destination column for Monday column type
                const questionDestinoRow = document.getElementById(`question-destino-row-${formType}-${index}`);
                if (questionDestinoRow) {
                    questionDestinoRow.style.display = this.value === 'monday_column' ? 'block' : 'none';
                }

                // Handle Monday column text field
                if (textInput) {
                    if (this.value === 'monday_column') {
                        textInput.setAttribute('readonly', 'readonly');
                        textInput.value = '';
                        textInput.placeholder = 'Será preenchido automaticamente com o valor da coluna';
                        // Add helper text
                        let helpText = textInput.parentNode.querySelector('.text-muted');
                        if (!helpText) {
                            helpText = document.createElement('small');
                            helpText.className = 'text-muted';
                            helpText.textContent = 'Para perguntas do tipo "Coluna do Monday", o título será o valor da coluna e a pergunta será uma avaliação de 1-10';
                            textInput.parentNode.appendChild(helpText);
                        }
                    } else {
                        textInput.removeAttribute('readonly');
                        textInput.placeholder = 'Digite o texto da pergunta';
                        // Remove helper text
                        const helpText = textInput.parentNode.querySelector('.text-muted');
                        if (helpText) {
                            helpText.remove();
                        }
                    }
                }
            });
        }

        return div;
    }

    getQuestionNumber(formType, index) {
        // Count only non-divider questions up to this index
        let questionCount = 0;
        const questions = this.config[formType]?.questions || [];

        for (let i = 0; i <= index && i < questions.length; i++) {
            if (questions[i].type !== 'divider') {
                questionCount++;
            }
        }

        return questionCount;
    }

    addQuestion(formType) {
        const questionsContainer = document.getElementById(`${formType}-questions`);
        const existingQuestions = questionsContainer.querySelectorAll('.question-item, .divider-item');
        const questionCount = existingQuestions.length;

        // Initialize questions array if it doesn't exist
        if (!this.config[formType]) this.config[formType] = {};
        if (!this.config[formType].questions) this.config[formType].questions = [];

        const newQuestion = {
            id: `question_${Date.now()}`,
            type: 'text',
            text: '',
            required: false,
            source: 'manual'
        };

        // Add to config array
        this.config[formType].questions.push(newQuestion);

        const questionElement = this.createQuestionElement(newQuestion, questionCount, formType);

        // If there are existing questions, add a divider line before the new question
        if (questionCount > 0) {
            const dividerLine = this.createDividerLine(formType, questionCount - 1);
            questionsContainer.appendChild(dividerLine);
        }

        // Append the new question to the end of the container
        questionsContainer.appendChild(questionElement);

        // Refresh feather icons
        setTimeout(() => {
            feather.replace();
        }, 0);
    }

    addDivider(formType, insertAfter = null) {
        const questionsContainer = document.getElementById(`${formType}-questions`);
        const dividerElement = this.createDividerElement(formType);

        if (insertAfter) {
            insertAfter.insertAdjacentElement('afterend', dividerElement);
        } else {
            // Append to the end of the container
            questionsContainer.appendChild(dividerElement);
        }

        // Refresh feather icons
        setTimeout(() => {
            feather.replace();
        }, 0);
    }

    createDividerLine(formType, afterIndex) {
        const dividerLine = document.createElement('div');
        dividerLine.className = 'question-divider-line';
        dividerLine.innerHTML = `
            <div class="divider-container">
                <div class="dotted-line"></div>
                <button type="button" class="divider-add-btn" onclick="adminInterface.showDividerInput(this, '${formType}', ${afterIndex})">
                    <i data-feather="plus"></i>
                </button>
                <div class="dotted-line"></div>
            </div>
            <style>
                .question-divider-line {
                    margin: 20px 0;
                }
                .divider-container {
                    display: flex;
                    align-items: center;
                    width: 100%;
                }
                .dotted-line {
                    flex: 1;
                    height: 1px;
                    border-top: 2px dotted #dee2e6;
                }
                .divider-add-btn {
                    background: #fff;
                    border: 2px dotted #dee2e6;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .divider-add-btn:hover {
                    background: #f8f9fa;
                    border-color: #6c757d;
                }
                .divider-add-btn i {
                    width: 16px;
                    height: 16px;
                }
            </style>
        `;
        return dividerLine;
    }

    createDividerElement(formType, title = '', index = 0) {
        const dividerDiv = document.createElement('div');
        dividerDiv.className = 'divider-item mb-3';
        dividerDiv.innerHTML = `
            <div class="divider-header">
                <h4 class="section-title">${title || 'Divisor de Seção'}</h4>
                <button type="button" class="btn btn-danger btn-sm" onclick="adminInterface.removeDivider(this, '${formType}')">
                    <i data-feather="trash-2"></i> Remover
                </button>
            </div>
            <style>
                .divider-item {
                    background: #f8f9fa;
                    border: 2px dashed #dee2e6;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 15px 0;
                }
                .divider-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .section-title {
                    color: #6c757d;
                    font-size: 1.1rem;
                    margin: 0;
                }
            </style>
        `;
        return dividerDiv;
    }

    removeQuestion(button, formType) {
        const questionItem = button.closest('.question-item');
        if (!questionItem) return;

        // Find the question index by looking at the data-path attributes
        const inputs = questionItem.querySelectorAll('[data-path]');
        if (inputs.length > 0) {
            const path = inputs[0].dataset.path;
            const pathParts = path.split('.');
            const questionIndex = parseInt(pathParts[2]); // Extract index from path like "guias.questions.0.text"

            if (!isNaN(questionIndex) && this.config[formType] && this.config[formType].questions) {
                // Remove from config
                this.config[formType].questions.splice(questionIndex, 1);

                // Re-render to update indices
                this.renderQuestions(formType);
                return;
            }
        }

        // Fallback: just remove the element
        questionItem.remove();
        this.saveQuestions(formType);
    }

    showDividerInput(button, formType, afterIndex) {
        const title = prompt('Digite o título da seção:');
        if (title && title.trim()) {
            // Update config
            if (!this.config[formType]) this.config[formType] = {};
            if (!this.config[formType].questions) this.config[formType].questions = [];

            // Insert divider in questions array at the correct position
            let insertIndex;
            if (afterIndex === -1) {
                // Insert at the beginning for the initial divider
                insertIndex = 0;
            } else {
                insertIndex = afterIndex + 1;
            }

            this.config[formType].questions.splice(insertIndex, 0, {
                id: `divider_${Date.now()}`,
                type: 'divider',
                title: title.trim()
            });

            // Re-render all questions to maintain proper order
            this.renderQuestions(formType);

            // Refresh feather icons
            setTimeout(() => {
                feather.replace();
            }, 0);
        }
    }

    removeDivider(button, formType) {
        if (confirm('Tem certeza que deseja remover este divisor?')) {
            button.closest('.divider-item').remove();
            this.saveQuestions(formType);
        }
    }

    moveItem(formType, index, direction) {
        if (!this.config[formType] || !this.config[formType].questions) {
            return;
        }

        const items = this.config[formType].questions;
        let newIndex;

        if (direction === 'up' && index > 0) {
            newIndex = index - 1;
        } else if (direction === 'down' && index < items.length - 1) {
            newIndex = index + 1;
        } else {
            return; // Can't move
        }

        // Swap items (questions or sections)
        const temp = items[index];
        items[index] = items[newIndex];
        items[newIndex] = temp;

        // Re-render questions and sections
        this.renderQuestions(formType);
        this.updateAllConditionalDropdowns(formType);
    }

    // Keep the old function for backward compatibility
    moveQuestion(formType, index, direction) {
        this.moveItem(formType, index, direction);
    }

    updateConfigFromInput(input) {
        const path = input.dataset.path;
        const value = input.type === 'checkbox' ? input.checked : input.value;

        // Convert string values to appropriate types
        let processedValue = value;
        if (value === 'true') processedValue = true;
        if (value === 'false') processedValue = false;

        this.setNestedValue(this.config, path, processedValue);

        // If this is a question text or type change, update conditional dropdowns
        if (path.includes('.questions.') && (path.endsWith('.text') || path.endsWith('.type'))) {
            const pathParts = path.split('.');
            const formType = pathParts[0];
            this.updateAllConditionalDropdowns(formType);
        }
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = isNaN(keys[i + 1]) ? {} : [];
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    async saveConfiguration() {
        try {
            // Update basic config from inputs
            ['guias', 'clientes', 'fornecedores'].forEach(formType => {
                if (!this.config[formType]) this.config[formType] = {};

                const boardA = document.getElementById(`${formType}-board-a`);
                const boardB = document.getElementById(`${formType}-board-b`);
                const linkColumn = document.getElementById(`${formType}-link-column`);

                if (boardA) this.config[formType].board_a = boardA.value;
                if (boardB) this.config[formType].board_b = boardB.value;
                if (linkColumn) this.config[formType].link_column = linkColumn.value;

                // Update questions title
                const questionsTitle = document.getElementById(`${formType}-questions-title`);
                if (questionsTitle) this.config[formType].questions_title = questionsTitle.value;
            });

            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.config)
            });

            if (response.ok) {
                this.showNotification('Configuração salva com sucesso!', 'success');
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showNotification('Erro ao salvar configuração', 'error');
        }
    }

    getQuestionOptions(formType, currentIndex, selectedValue) {
        const questions = this.config[formType]?.questions || [];
        let options = '';

        questions.forEach((question, index) => {
            if (index < currentIndex && question.type === 'yesno') {
                const selected = selectedValue === question.id ? 'selected' : '';
                options += `<option value="${question.id}" ${selected}>${question.text || `Pergunta ${index + 1}`}</option>`;
            }
        });

        return options;
    }

    toggleConditionalFields(formType, index, isChecked) {
        const fieldsContainer = document.getElementById(`conditional-fields-${formType}-${index}`);
        if (fieldsContainer) {
            fieldsContainer.style.display = isChecked ? 'block' : 'none';
        }

        // Update config
        if (!this.config[formType].questions[index].conditional) {
            this.config[formType].questions[index].conditional = {};
        }

        if (isChecked) {
            this.config[formType].questions[index].conditional = {
                depends_on: '',
                show_if: ''
            };
            // Update the dropdown with current questions
            this.updateConditionalDropdown(formType, index);
        } else {
            delete this.config[formType].questions[index].conditional;
        }
    }

    updateConditionalDropdown(formType, index) {
        const dependsOnSelect = document.querySelector(`select[data-path="${formType}.questions.${index}.conditional.depends_on"]`);
        if (dependsOnSelect) {
            const currentValue = dependsOnSelect.value;
            const newOptions = this.getQuestionOptions(formType, index, currentValue);
            dependsOnSelect.innerHTML = '<option value="">Selecione uma pergunta</option>' + newOptions;
        }
    }

    updateAllConditionalDropdowns(formType) {
        // Update all conditional dropdowns for the form type
        if (this.config[formType] && this.config[formType].questions) {
            this.config[formType].questions.forEach((question, index) => {
                if (question.conditional && question.conditional.depends_on !== undefined) {
                    this.updateConditionalDropdown(formType, index);
                }
            });
        }
    }

    toggleQuestionFields(formType, index, questionType) {
        const sourceColumnDiv = document.getElementById(`source-column-${formType}-${index}`);
        const dropdownOptionsDiv = document.getElementById(`dropdown-options-${formType}-${index}`);
        const questionDestinoRow = document.getElementById(`question-destino-row-${formType}-${index}`);

        if (sourceColumnDiv) {
            sourceColumnDiv.style.display = questionType === 'monday_column' ? 'block' : 'none';
        }

        if (dropdownOptionsDiv) {
            dropdownOptionsDiv.style.display = questionType === 'dropdown' ? 'block' : 'none';
        }

        if (questionDestinoRow) {
            questionDestinoRow.style.display = questionType === 'monday_column' ? 'block' : 'none';
        }
    }

    // Keep the old function for backward compatibility
    toggleSourceColumn(formType, index, questionType) {
        this.toggleQuestionFields(formType, index, questionType);
    }

    async loadForms() {
        const loadingElement = document.getElementById('formsLoading');
        const emptyElement = document.getElementById('formsEmpty');
        const listElement = document.getElementById('formsList');
        const countElement = document.getElementById('formsCount');

        // Show loading
        loadingElement.style.display = 'block';
        emptyElement.style.display = 'none';
        listElement.style.display = 'none';

        try {
            const response = await fetch('/api/forms');
            if (!response.ok) {
                throw new Error('Failed to load forms');
            }

            const forms = await response.json();

            // Update count
            countElement.textContent = forms.length;

            // Hide loading
            loadingElement.style.display = 'none';

            if (forms.length === 0) {
                emptyElement.style.display = 'block';
            } else {
                listElement.style.display = 'flex';
                this.renderFormsList(forms);
            }
        } catch (error) {
            console.error('Error loading forms:', error);
            loadingElement.style.display = 'none';
            this.showNotification('Erro ao carregar formulários', 'error');
        }
    }

    renderFormsList(forms) {
        const listElement = document.getElementById('formsList');
        listElement.innerHTML = '';

        forms.forEach(form => {
            const formCard = this.createFormCard(form);
            listElement.appendChild(formCard);
        });
    }

    createFormCard(form) {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4 mb-3';

        const createdDate = form.created_at ? new Date(form.created_at).toLocaleString('pt-BR') : 'Data desconhecida';
        const typeColors = {
            'guias': 'success',
            'clientes': 'primary',
            'fornecedores': 'warning'
        };
        const typeColor = typeColors[form.type] || 'secondary';

        div.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge bg-${typeColor}">${form.type}</span>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                <i data-feather="more-vertical" style="width: 14px; height: 14px;"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="/form/${form.id}" target="_blank">
                                    <i data-feather="external-link" style="width: 14px; height: 14px;" class="me-2"></i>
                                    Abrir Formulário
                                </a></li>
                                <li><button class="dropdown-item text-danger" onclick="adminInterface.deleteForm('${form.id}')">
                                    <i data-feather="trash-2" style="width: 14px; height: 14px;" class="me-2"></i>
                                    Excluir
                                </button></li>
                            </ul>
                        </div>
                    </div>
                    <h6 class="card-title">${form.title}</h6>
                    ${form.item_name ? `<p class="card-text text-muted small">Item: ${form.item_name}</p>` : ''}
                    <p class="card-text small">
                        <small class="text-muted">
                            <i data-feather="calendar" style="width: 12px; height: 12px;" class="me-1"></i>
                            ${createdDate}
                        </small>
                    </p>
                </div>
                <div class="card-footer bg-transparent">
                    <a href="/form/${form.id}" target="_blank" class="btn btn-outline-primary btn-sm w-100">
                        <i data-feather="external-link" style="width: 14px; height: 14px;" class="me-2"></i>
                        Visualizar Formulário
                    </a>
                </div>
            </div>
        `;

        // Replace feather icons
        setTimeout(() => {
            feather.replace();
        }, 0);

        return div;
    }

    async deleteForm(formId) {
        if (!confirm('Tem certeza que deseja excluir este formulário? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const response = await fetch(`/api/forms/${formId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification('Formulário excluído com sucesso!', 'success');
                this.loadForms(); // Reload the list
            } else {
                throw new Error('Failed to delete form');
            }
        } catch (error) {
            console.error('Error deleting form:', error);
            this.showNotification('Erro ao excluir formulário', 'error');
        }
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    saveQuestions(formType) {
        const questionsContainer = document.getElementById(`${formType}-questions`);

        // Collect all items (questions and dividers) in order
        const allItems = Array.from(questionsContainer.children)
            .filter(item => item.classList.contains('question-item') || item.classList.contains('divider-item'))
            .map(item => {
                if (item.classList.contains('divider-item')) {
                    return {
                        id: `divider_${Date.now()}`,
                        type: 'divider',
                        title: item.querySelector('.section-title').textContent
                    };
                } else {
                    const question = {
                        id: item.querySelector('input[placeholder="id_da_pergunta"]').value || `question_${Date.now()}`,
                        type: item.querySelector('select').value,
                        text: item.querySelector('input[data-path*=".text"]').value,
                        required: item.querySelector('select[data-path*=".required"]').value === 'true',
                        source: 'manual'
                    };

                    // Add conditional logic if present
                    const conditionalCheckbox = item.querySelector('input[data-path*=".is_conditional"]');
                    if (conditionalCheckbox && conditionalCheckbox.checked) {
                        const dependsOnSelect = item.querySelector('select[data-path*=".conditional.depends_on"]');
                        const showIfSelect = item.querySelector('select[data-path*=".conditional.show_if"]');
                        question.conditional = {
                            depends_on: dependsOnSelect ? dependsOnSelect.value : '',
                            show_if: showIfSelect ? showIfSelect.value : 'yes'
                        };
                    }

                    // Add type-specific properties
                    if (question.type === 'dropdown') {
                        const optionsInput = item.querySelector('input[data-path*=".dropdown_options"]');
                        if (optionsInput) {
                            question.dropdown_options = optionsInput.value;
                        }
                    }

                    if (question.type === 'monday_column') {
                        const sourceColumnInput = item.querySelector('input[data-path*=".source_column"]');
                        if (sourceColumnInput) {
                            question.source_column = sourceColumnInput.value;
                        }
                        
                        const questionDestinationColumnInput = item.querySelector('input[data-path*=".question_destination_column"]');
                        if (questionDestinationColumnInput) {
                            question.question_destination_column = questionDestinationColumnInput.value;
                        }
                    }

                    const destinationColumnInput = item.querySelector('input[data-path*=".destination_column"]');
                    if (destinationColumnInput) {
                        question.destination_column = destinationColumnInput.value;
                    }

                    return question;
                }
            });

        this.config[formType].questions = allItems;
    }
}

// Rating selection function for forms
function selectRating(questionId, value) {
    // Remove selected class from all circles in this question
    document.querySelectorAll(`[onclick*="${questionId}"]`).forEach(circle => {
        circle.classList.remove('selected');
    });

    // Add selected class to clicked circle
    event.target.classList.add('selected');

    // Set hidden input value
    const hiddenInput = document.getElementById(`${questionId}_input`);
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

// Initialize admin interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('admin-interface')) {
        window.adminInterface = new AdminInterface();
    }
});

// Add CSS for notifications
const notificationCSS = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;

const style = document.createElement('style');
style.textContent = notificationCSS;
document.head.appendChild(style);
