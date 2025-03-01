document.addEventListener('DOMContentLoaded', () => {
  // Add API key management variables
  let currentApiKey = null;
  const defaultApiKey = '';
  
  // Create API key input elements
  const apiKeyContainer = document.createElement('div');
  apiKeyContainer.className = 'api-key-container collapsed';
  apiKeyContainer.innerHTML = `
    <div class="api-key-header" id="apiKeyToggle">
      <span class="material-symbols-rounded">key</span>
      <span>API Key (Required)</span>
      <div class="api-key-status"></div>
      <span class="material-symbols-rounded expand-icon">expand_more</span>
    </div>
    <div class="api-key-content">
      <div class="api-key-input">
        <input type="password" id="apiKeyInput" placeholder="Enter your Gemini API key to enable prioritization">
        <button id="saveApiKey" class="icon-button">
          <span class="material-symbols-rounded">save</span>
        </button>
        <button id="toggleApiKey" class="icon-button">
          <span class="material-symbols-rounded">visibility_off</span>
        </button>
        <button id="clearApiKey" class="icon-button">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    </div>
  `;
  
  // Insert API key container at the top
  document.querySelector('.container').insertBefore(apiKeyContainer, document.querySelector('header'));
  
  // Get API key elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const clearApiKeyBtn = document.getElementById('clearApiKey');
  
  // Load saved API key
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      currentApiKey = result.apiKey;
      apiKeyInput.value = currentApiKey;
      updateApiKeyIcon(true);
    } else {
      updateApiKeyIcon(false);
      setTimeout(() => {
        showNotification('Please add your Gemini API key to enable task prioritization', 'warning');
        apiKeyContainer.classList.remove('collapsed');
        const expandIcon = apiKeyContainer.querySelector('.expand-icon');
        expandIcon.textContent = 'expand_less';
        apiKeyInput.focus();
      }, 500);
    }
  });
  
  // Save API key
  saveApiKeyBtn.addEventListener('click', () => {
    const newApiKey = apiKeyInput.value.trim();
    if (!newApiKey) {
      showNotification('Please enter an API key', 'warning');
      updateApiKeyIcon(false);
      return;
    }

    // Check if it's a valid API key format
    if (!/^[A-Za-z0-9_-]{39}$/.test(newApiKey)) {
      showNotification('Invalid API key format. Please check your key.', 'error');
      updateApiKeyIcon(false);
      return;
    }

    currentApiKey = newApiKey;
    chrome.storage.sync.set({ apiKey: newApiKey }, () => {
      showNotification('API key saved successfully', 'success');
      updateApiKeyIcon(true);
    });
  });
  
  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const isVisible = apiKeyInput.type === 'text';
    apiKeyInput.type = isVisible ? 'password' : 'text';
    toggleApiKeyBtn.querySelector('span').textContent = 
      isVisible ? 'visibility_off' : 'visibility';
  });
  
  // Clear API key
  clearApiKeyBtn.addEventListener('click', () => {
    apiKeyInput.value = '';
    currentApiKey = null;
    chrome.storage.sync.remove('apiKey', () => {
      showNotification('API key cleared', 'info');
      updateApiKeyIcon(false);
    });
  });

  // Toast notification function
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }, 100);
  }

  const taskNameInput = document.getElementById('taskName');
  const taskDetailsInput = document.getElementById('taskDetails');
  const taskDueDateInput = document.getElementById('taskDueDate');
  const addTodoBtn = document.getElementById('addTodo');
  const todoList = document.getElementById('todoList');
  const themeToggle = document.querySelector('.theme-toggle');
  const body = document.body;
  const addNewBtn = document.getElementById('addNewBtn');
  const cancelAddBtn = document.getElementById('cancelAdd');
  const inputPanel = document.getElementById('inputPanel');

  // Set min date to today but don't set default value
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  taskDueDateInput.min = now.toISOString().slice(0, 16);

  // Load existing todos
  chrome.storage.sync.get(['todos'], (result) => {
    const todos = result.todos || [];
    todos.forEach(todo => addTodoElement(todo));
  });

  // System theme detection
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  
  function setTheme(isDark) {
    body.classList.toggle('light-theme', !isDark);
    themeToggle.querySelector('.material-symbols-rounded').textContent = 
      isDark ? 'dark_mode' : 'light_mode';
    chrome.storage.sync.set({ theme: isDark ? 'dark' : 'light' });
  }

  // Load saved theme or use system preference
  chrome.storage.sync.get(['theme'], (result) => {
    if (result.theme) {
      setTheme(result.theme === 'dark');
    } else {
      setTheme(prefersDark.matches);
    }
  });

  // Listen for system theme changes
  prefersDark.addEventListener('change', (e) => {
    chrome.storage.sync.get(['theme'], (result) => {
      if (!result.theme) { // Only auto-switch if user hasn't set a preference
        setTheme(e.matches);
      }
    });
  });

  // Theme toggle functionality
  themeToggle.addEventListener('click', () => {
    const willBeDark = !body.classList.contains('light-theme');
    setTheme(!willBeDark);
  });

  // Input panel expansion
  function toggleInputPanel(show) {
    if (show) {
      inputPanel.classList.add('expanded');
      taskNameInput.focus();
    } else {
      inputPanel.classList.remove('expanded');
      // Clear inputs and reset their state
      taskNameInput.value = '';
      taskDetailsInput.value = '';
      taskDueDateInput.value = '';
      
      // Reset add button text and style
      const addButton = document.getElementById('addTodo');
      addButton.textContent = 'Add Task';
      addButton.classList.remove('editing');
      
      // Clear editing state
      delete inputPanel.dataset.editingId;
      
      // Reset floating labels
      taskNameInput.dispatchEvent(new Event('input'));
      taskDetailsInput.dispatchEvent(new Event('input'));
    }
  }

  addNewBtn.addEventListener('click', () => toggleInputPanel(true));
  cancelAddBtn.addEventListener('click', () => toggleInputPanel(false));

  // Update add todo button click handler
  addTodoBtn.addEventListener('click', async () => {
    if (!currentApiKey) {
      showNotification('Please add your Gemini API key to enable task prioritization', 'warning');
      return;
    }
    const taskName = taskNameInput.value.trim();
    const taskDetails = taskDetailsInput.value.trim();
    const taskDueDate = taskDueDateInput.value;
    
    if (taskName) {
      if (inputPanel.dataset.editingId) {
        // Update existing todo
        try {
          const result = await chrome.storage.sync.get(['todos']);
          const todos = result.todos || [];
          const todoIndex = todos.findIndex(t => t.id.toString() === inputPanel.dataset.editingId.toString());
          
          if (todoIndex !== -1) {
            // Update the todo
            todos[todoIndex] = {
              ...todos[todoIndex],
              name: taskName,
              details: taskDetails,
              dueDate: taskDueDate || null,
              modified: new Date().toISOString()
            };
            
            // Clear list and show loading state
            todoList.innerHTML = '';
            const tempTodos = [...todos];
            tempTodos.forEach(todo => {
              const element = addTodoElement(todo);
              element.classList.add('loading');
            });
            
            // Recalculate priorities
            const updatedTodos = await recalculateAllPriorities(todos);
            const sortedTodos = sortTasks(updatedTodos);
            
            // Save and re-render
            await chrome.storage.sync.set({ todos: sortedTodos });
            
            // Clear and re-render the entire list
            todoList.innerHTML = '';
            sortedTodos.forEach(todo => addTodoElement(todo));
            
            // Close the input panel
            toggleInputPanel(false);
          }
        } catch (error) {
          console.error('Failed to update task:', error);
          alert('Failed to update task. Please try again.');
        }
      } else {
        // Add new todo
        await addTodo(taskName, taskDetails, taskDueDate);
        toggleInputPanel(false);
      }
    }
  });

  // Update Enter key handler
  taskNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTodoBtn.click(); // Reuse the click handler logic
    }
  });

  // Add this notification system
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = document.createElement('span');
    icon.className = 'material-symbols-rounded';
    icon.textContent = {
      'error': 'error',
      'success': 'check_circle',
      'warning': 'warning',
      'info': 'info'
    }[type];
    
    const text = document.createElement('span');
    text.textContent = message;
    
    notification.appendChild(icon);
    notification.appendChild(text);
    
    // Remove existing notifications of the same type
    document.querySelectorAll(`.notification.${type}`).forEach(n => n.remove());
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 4000);
    }, 100);
  }

  async function analyzePriority(newTask, existingTasks) {
    if (!currentApiKey) {
      showNotification('Please add your API key in settings', 'warning');
      return 1;
    }

    const prompt = `You are a task priority analyzer. Analyze the given task and assign a priority score (1-10, where 10 is highest).

    Rules:
    - Return ONLY a single number between 1-10
    - Assign priority 1 for:
      * Gibberish or unclear tasks
      * Tasks without meaningful words
      * Spam-like content
    - Consider task name more important than details
    - Higher priority for:
      * Urgent deadlines
      * Important keywords (urgent, asap, critical, blocking)
      * Tasks blocking others
      * Clear, actionable items
    - Lower priority for:
      * Vague descriptions
      * Far future deadlines
      * Optional or nice-to-have tasks

    New Task:
    - Name: ${newTask.name}
    - Details: ${newTask.details || 'No details'}
    - Due: ${newTask.dueDate ? new Date(newTask.dueDate).toLocaleString() : 'Never'}
    - Created: ${new Date(newTask.created).toLocaleString()}

    Context (${existingTasks.length} existing tasks):
    ${existingTasks.map(task => `
    - Name: ${task.name}
      Details: ${task.details || 'No details'}
      Due: ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Never'}
      Priority: ${task.priority}/10
    `).join('\n')}

    Priority Scale:
    10: Critical/Blocking/Urgent
    8-9: High importance, near deadline
    6-7: Important, has deadline
    4-5: Normal priority
    2-3: Low priority, optional
    1: Unclear/Invalid/Gibberish

    Analyze the task and respond with only a number 1-10.`;

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + currentApiKey,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.3,
              topK: 1,
              topP: 0.1,
              maxOutputTokens: 1
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.status === 'INVALID_ARGUMENT') {
          showNotification('Invalid API key. Please check your key.', 'error');
          updateApiKeyIcon(false);
        } else {
          showNotification(`API Error: ${error.error?.message || 'Unknown error'}`, 'error');
        }
        return 1;
      }

      const data = await response.json();
      
      // Extract the priority number from Gemini's response
      const responseText = data.candidates[0].content.parts[0].text;
      const priority = parseInt(responseText.match(/\d+/)[0]);
      
      // Additional validation for gibberish/invalid tasks
      if (isNaN(priority) || 
          /^[^a-zA-Z]*$/.test(newTask.name.trim()) || // No letters
          newTask.name.length < 3 || // Too short
          /^[a-zA-Z]{1,2}$/.test(newTask.name.trim()) || // Just 1-2 letters
          /^[0-9]+$/.test(newTask.name.trim()) // Only numbers
      ) {
        return 1;
      }
      
      return Math.min(Math.max(priority, 1), 10);
    } catch (error) {
      console.error('Priority analysis failed:', error);
      if (error.message.includes('Failed to fetch')) {
        showNotification('Network error. Please check your internet connection.', 'error');
      } else {
        showNotification('Failed to analyze priority. Please try again.', 'error');
      }
      return 1;
    }
  }

  function sortTasks(todos) {
    return todos.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return b.priority - a.priority;
    });
  }

  // Add this function to handle loading state
  function setLoadingState(isLoading) {
    const overlay = document.getElementById('loadingOverlay') || createLoadingOverlay();
    
    if (isLoading) {
      document.body.classList.add('loading');
      overlay.style.display = 'block';
      // Disable all interactive elements
      document.querySelectorAll('button, input, textarea').forEach(el => {
        el.disabled = true;
      });
    } else {
      document.body.classList.remove('loading');
      overlay.style.display = 'none';
      // Re-enable all interactive elements
      document.querySelectorAll('button, input, textarea').forEach(el => {
        el.disabled = false;
      });
    }
  }

  // Function to create loading overlay
  function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    document.body.appendChild(overlay);
    return overlay;
  }

  // Update the recalculateAllPriorities function
  async function recalculateAllPriorities(todos) {
    const updatedTodos = [...todos];
    
    setLoadingState(true);

    try {
      // Recalculate priority for each task
      for (let i = 0; i < updatedTodos.length; i++) {
        const currentTodo = updatedTodos[i];
        const otherTodos = updatedTodos.filter((_, index) => index !== i);
        currentTodo.priority = await analyzePriority(currentTodo, otherTodos);
      }
    } finally {
      setLoadingState(false);
    }

    return updatedTodos;
  }

  // Update the addTodo function
  async function addTodo(name, details, dueDate) {
    const creationTime = new Date();
    const newTodo = {
      id: Date.now(),
      name: name,
      details: details,
      dueDate: dueDate || null,
      created: creationTime.toISOString(),
      completed: false,
      priority: 5 // Default priority
    };

    chrome.storage.sync.get(['todos'], async (result) => {
      const todos = result.todos || [];
      todos.push(newTodo);
      
      // Show loading state for all tasks
      todoList.innerHTML = '';
      todos.forEach(todo => {
        const element = addTodoElement(todo);
        element.classList.add('loading');
        const badge = element.querySelector('.priority-badge');
        if (badge) {
          badge.classList.add('loading');
        }
      });
      
      try {
        // Recalculate all priorities
        const updatedTodos = await recalculateAllPriorities(todos);
        const sortedTodos = sortTasks(updatedTodos);
        
        chrome.storage.sync.set({ todos: sortedTodos }, () => {
          // Re-render all todos with new priorities
          todoList.innerHTML = '';
          sortedTodos.forEach(todo => addTodoElement(todo));
        });
        showNotification('Task added successfully!', 'success');
      } catch (error) {
        console.error('Failed to update priorities:', error);
        // Remove loading state if there's an error
        document.querySelectorAll('.todo-item').forEach(item => {
          item.classList.remove('loading');
          const badge = item.querySelector('.priority-badge');
          if (badge) {
            badge.classList.remove('loading');
          }
        });
      }
    });
  }

  function formatDueDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now && date.toDateString() !== now.toDateString();
    
    const options = { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    };
    
    if (date.getFullYear() !== now.getFullYear()) {
      options.year = 'numeric';
    }
    
    return {
      formatted: date.toLocaleDateString('en-US', options),
      isOverdue
    };
  }

  function addTodoElement(todo) {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.dataset.id = todo.id;
    
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';
    
    const priorityBadge = document.createElement('div');
    priorityBadge.className = `priority-badge p${todo.priority}`;
    priorityBadge.title = `Priority: ${todo.priority}/10`;
    priorityBadge.textContent = todo.priority;
    
    const textContainer = document.createElement('div');
    textContainer.className = 'text-container';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = todo.name;
    textSpan.className = 'task-name';
    
    textContainer.appendChild(priorityBadge);
    textContainer.appendChild(textSpan);
    
    const actionButtons = document.createElement('div');
    actionButtons.className = 'task-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    const editIcon = document.createElement('span');
    editIcon.className = 'material-symbols-rounded';
    editIcon.textContent = 'edit';
    editBtn.appendChild(editIcon);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'material-symbols-rounded';
    deleteIcon.textContent = 'close';
    deleteBtn.appendChild(deleteIcon);
    
    actionButtons.appendChild(editBtn);
    actionButtons.appendChild(deleteBtn);
    
    taskHeader.appendChild(textContainer);
    taskHeader.appendChild(actionButtons);
    
    li.appendChild(taskHeader);

    // Always show creation time
    const createdDiv = document.createElement('div');
    createdDiv.className = 'task-due-date';
    
    const createdIcon = document.createElement('span');
    createdIcon.className = 'material-symbols-rounded';
    createdIcon.textContent = 'schedule';
    
    createdDiv.appendChild(createdIcon);
    createdDiv.appendChild(document.createTextNode('Created: ' + formatDate(todo.created)));
    li.appendChild(createdDiv);

    // Always show due date section, but show "Never" if not set
    const dueDateDiv = document.createElement('div');
    dueDateDiv.className = 'task-due-date';
    
    const clockIcon = document.createElement('span');
    clockIcon.className = 'material-symbols-rounded';
    clockIcon.textContent = 'event';
    
    dueDateDiv.appendChild(clockIcon);
    
    if (todo.dueDate) {
      const { formatted, isOverdue } = formatDueDate(todo.dueDate);
      dueDateDiv.className += isOverdue ? ' overdue' : '';
      dueDateDiv.appendChild(document.createTextNode('Due: ' + formatted));
    } else {
      dueDateDiv.appendChild(document.createTextNode('Due: Never'));
    }
    
    li.appendChild(dueDateDiv);

    if (todo.details) {
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'task-details';
      detailsDiv.textContent = todo.details;
      
      // Add click handler for expanding/collapsing
      detailsDiv.addEventListener('click', () => {
        detailsDiv.classList.toggle('expanded');
      });
      
      // Check if content needs expand option
      const needsExpand = detailsDiv.scrollHeight > detailsDiv.clientHeight;
      if (!needsExpand) {
        detailsDiv.style.cursor = 'default';
      }
      
      li.appendChild(detailsDiv);
    }

    if (todo.completed) {
      li.classList.add('completed');
    }
    
    todoList.appendChild(li);

    // Toggle completion
    textSpan.addEventListener('click', () => {
      chrome.storage.sync.get(['todos'], (result) => {
        const todos = result.todos || [];
        const todoIndex = todos.findIndex(t => t.id === todo.id);
        todos[todoIndex].completed = !todos[todoIndex].completed;
        chrome.storage.sync.set({ todos: todos }, () => {
          li.classList.toggle('completed');
        });
      });
    });

    // Delete todo
    deleteBtn.addEventListener('click', () => {
      chrome.storage.sync.get(['todos'], async (result) => {
        const todos = result.todos || [];
        const updatedTodos = todos.filter(t => t.id !== todo.id);
        
        // Show loading state for remaining tasks
        document.querySelectorAll('.todo-item').forEach(item => {
          if (item.dataset.id !== todo.id) {
            item.classList.add('loading');
            const badge = item.querySelector('.priority-badge');
            if (badge) {
              badge.classList.add('loading');
            }
          }
        });

        try {
          // Remove the deleted task immediately
          li.remove();
          
          // Recalculate priorities for remaining tasks
          if (updatedTodos.length > 0) {
            const reorderedTodos = await recalculateAllPriorities(updatedTodos);
            const sortedTodos = sortTasks(reorderedTodos);
            
            chrome.storage.sync.set({ todos: sortedTodos }, () => {
              // Re-render all todos with new priorities
              todoList.innerHTML = '';
              sortedTodos.forEach(todo => addTodoElement(todo));
            });
          } else {
            // If no tasks remain, just update storage
            chrome.storage.sync.set({ todos: [] });
          }
        } catch (error) {
          console.error('Failed to update priorities after deletion:', error);
          // Remove loading state if there's an error
          document.querySelectorAll('.todo-item').forEach(item => {
            item.classList.remove('loading');
            const badge = item.querySelector('.priority-badge');
            if (badge) {
              badge.classList.remove('loading');
            }
          });
          
          // At least remove the deleted task
          chrome.storage.sync.set({ todos: updatedTodos });
          li.remove();
        }
      });
    });

    // Add edit button click handler
    editBtn.addEventListener('click', () => {
      editTodo(todo);
    });

    return li;
  }

  // Helper function to format creation date
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    
    const options = { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    };
    
    if (date.getFullYear() !== new Date().getFullYear()) {
      options.year = 'numeric';
    }
    
    return date.toLocaleDateString('en-US', options);
  }

  // Update the editTodo function
  function editTodo(todo) {
    // Show input panel with existing task data
    inputPanel.classList.add('expanded');
    
    // Ensure all fields are properly populated
    taskNameInput.value = todo.name || '';
    taskDetailsInput.value = todo.details || '';
    // Format the date properly for datetime-local input
    if (todo.dueDate) {
      const dueDate = new Date(todo.dueDate);
      dueDate.setMinutes(dueDate.getMinutes() - dueDate.getTimezoneOffset());
      taskDueDateInput.value = dueDate.toISOString().slice(0, 16);
    } else {
      taskDueDateInput.value = '';
    }
    
    // Change add button to save button
    const addButton = document.getElementById('addTodo');
    addButton.textContent = 'Save';
    addButton.classList.add('editing');
    
    // Store the task being edited
    inputPanel.dataset.editingId = todo.id;
    
    // Focus the name input
    taskNameInput.focus();
    
    // Trigger input events to ensure floating labels work
    taskNameInput.dispatchEvent(new Event('input'));
    taskDetailsInput.dispatchEvent(new Event('input'));
  }

  // Add some CSS for the editing state
  const style = document.createElement('style');
  style.textContent = `
    #addTodo.editing {
      background-color: #2196F3;
    }
    
    .input-panel.expanded {
      z-index: 1000;
    }
  `;
  document.head.appendChild(style);

  // Add toggle functionality
  const apiKeyToggle = apiKeyContainer.querySelector('#apiKeyToggle');
  apiKeyToggle.addEventListener('click', () => {
    apiKeyContainer.classList.toggle('collapsed');
    const expandIcon = apiKeyToggle.querySelector('.expand-icon');
    expandIcon.textContent = apiKeyContainer.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
  });

  // Add this function to update the API key icon state
  function updateApiKeyIcon(hasValidKey) {
    const keyIcon = apiKeyContainer.querySelector('.api-key-header .material-symbols-rounded');
    const statusDiv = apiKeyContainer.querySelector('.api-key-status');
    
    keyIcon.className = `material-symbols-rounded ${hasValidKey ? 'valid-key' : 'invalid-key'}`;
    statusDiv.className = `api-key-status ${hasValidKey ? 'valid' : 'invalid'}`;
    statusDiv.innerHTML = hasValidKey 
      ? '&check; API Key is set and ready to use' 
      : '&#x2717; API Key not set';
  }
}); 