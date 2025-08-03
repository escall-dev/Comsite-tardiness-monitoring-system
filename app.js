// Tardiness Monitoring System - Enhanced Application
class TardinessMonitor {
    constructor() {
        this.db = null;
        this.data = [];
        this.filteredData = [];
        this.currentMode = 'manual';
        this.isOnline = navigator.onLine;
        this.pendingSync = [];
        this.gradeStrandSections = [];
        
        this.initializeApp();
        this.setupEventListeners();
        this.loadUserPreferences();
        this.startClock();
        this.initializeFirebase();
    }

    async initializeFirebase() {
        try {
            // Wait for Firebase to be available
            while (!window.db || !window.firebaseFunctions) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.db = window.db;
            this.firebase = window.firebaseFunctions;
            await this.loadGradeStrandSections();
            await this.loadData();
            this.setupOfflineDetection();
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.showToast('Firebase connection failed. Using local mode.', 'error');
            this.loadDataFromLocalStorage();
        }
    }

    initializeApp() {
        // Initialize DOM elements
        this.elements = {
            currentTime: document.getElementById('currentTime'),
            currentDate: document.getElementById('currentDate'),
            themeToggle: document.getElementById('themeToggle'),
            manualModeBtn: document.getElementById('manualModeBtn'),
            quickSelectModeBtn: document.getElementById('quickSelectModeBtn'),
            manualMode: document.getElementById('manualMode'),
            quickSelectMode: document.getElementById('quickSelectMode'),
            manualForm: document.getElementById('manualForm'),
            searchInput: document.getElementById('searchInput'),
            gradeFilter: document.getElementById('gradeFilter'),
            strandFilter: document.getElementById('strandFilter'),
            sectionFilter: document.getElementById('sectionFilter'),
            sortOrder: document.getElementById('sortOrder'),
            tableBody: document.getElementById('tableBody'),
            todayCount: document.getElementById('todayCount'),
            weekCount: document.getElementById('weekCount'),
            monthCount: document.getElementById('monthCount'),
            exportExcel: document.getElementById('exportExcel'),
            exportPDF: document.getElementById('exportPDF'),
            exportImage: document.getElementById('exportImage'),
            editModal: document.getElementById('editModal'),
            editForm: document.getElementById('editForm'),
            toastContainer: document.getElementById('toastContainer'),
            managementModal: document.getElementById('managementModal'),
            managementForm: document.getElementById('managementForm'),
            manualEntryModal: document.getElementById('manualEntryModal'),
            addQuickSelectBtn: document.getElementById('addQuickSelectBtn'),
            addManualEntryBtn: document.getElementById('addManualEntryBtn'),
            quickSelectGrid: document.getElementById('quickSelectGrid'),
            filterToggle: document.getElementById('filterToggle'),
            filterControls: document.getElementById('filterControls')
        };
    }

    setupEventListeners() {
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Mode switching
        this.elements.manualModeBtn.addEventListener('click', () => this.switchMode('manual'));
        this.elements.quickSelectModeBtn.addEventListener('click', () => this.switchMode('quick'));

        // Manual form submission
        this.elements.manualForm.addEventListener('submit', (e) => this.handleManualSubmit(e));

        // Search and filters
        this.elements.searchInput.addEventListener('input', () => this.filterData());
        this.elements.gradeFilter.addEventListener('change', () => this.filterData());
        this.elements.strandFilter.addEventListener('change', () => this.filterData());
        this.elements.sectionFilter.addEventListener('change', () => this.filterData());
        this.elements.sortOrder.addEventListener('change', () => this.filterData());

        // Export buttons
        this.elements.exportExcel.addEventListener('click', () => this.exportToExcel());
        this.elements.exportPDF.addEventListener('click', () => this.exportToPDF());
        // Export Image now opens modal - handled by onclick in HTML but we also add event listener
        if (this.elements.exportImage) {
            this.elements.exportImage.addEventListener('click', () => this.openExportModal());
        }
        
        // Initialize export modal after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.initializeExportModal();
        }, 200);

        // Modal events
        document.querySelectorAll('.close').forEach(close => {
            close.addEventListener('click', () => this.closeModal());
        });
        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        this.elements.editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));

        // Management modal
        this.elements.addQuickSelectBtn.addEventListener('click', () => this.openManagementModal());
        this.elements.managementForm.addEventListener('submit', (e) => this.handleManagementSubmit(e));

        // Manual entry modal
        this.elements.addManualEntryBtn.addEventListener('click', () => this.openManualEntryModal());

        // Filter toggle
        this.elements.filterToggle.addEventListener('click', () => this.toggleFilterPanel());

        // Window events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'deleteModal') {
                    this.closeDeleteModal();
                } else {
                    this.closeModal();
                }
            }
        });
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            this.elements.currentTime.textContent = now.toLocaleTimeString();
            this.elements.currentDate.textContent = now.toLocaleDateString();
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        if (mode === 'manual') {
            this.elements.manualModeBtn.classList.add('active');
            this.elements.manualMode.style.display = 'block';
            this.elements.quickSelectMode.style.display = 'none';
        } else {
            this.elements.quickSelectModeBtn.classList.add('active');
            this.elements.manualMode.style.display = 'none';
            this.elements.quickSelectMode.style.display = 'block';
        }

        // Save preference
        this.saveUserPreference('currentMode', mode);
    }

    toggleFilterPanel() {
        const controls = this.elements.filterControls;
        const isVisible = controls.style.display !== 'none';
        controls.style.display = isVisible ? 'none' : 'block';
        
        const btn = this.elements.filterToggle;
        btn.innerHTML = isVisible ? 
            '<i class="fas fa-filter"></i> Show Filters' : 
            '<i class="fas fa-filter"></i> Hide Filters';
    }

    async loadGradeStrandSections() {
        try {
            // Load from localStorage first
            const localGSS = localStorage.getItem('gradeStrandSections');
            if (localGSS) {
                this.gradeStrandSections = JSON.parse(localGSS);
            } else {
                // Initialize with default options if none exist
                this.gradeStrandSections = [
                    { grade: 11, strand: 'STEM', section: 'A' },
                    { grade: 11, strand: 'STEM', section: 'B' },
                    { grade: 12, strand: 'STEM', section: 'A' },
                    { grade: 11, strand: 'HUMSS', section: 'A' },
                    { grade: 12, strand: 'HUMSS', section: 'A' }
                ];
                this.saveGradeStrandSectionsToLocal();
            }
            
            this.updateDropdowns();
            this.updateQuickSelectGrid();

            // Load from Firebase if online
            if (this.isOnline && this.db && this.firebase) {
                const gradeStrandSectionsRef = this.firebase.collection(this.db, 'gradeStrandSections');
                const snapshot = await this.firebase.getDocs(gradeStrandSectionsRef);
                const firebaseGSS = snapshot.docs.map(doc => doc.data());
                
                // Merge with local data
                this.gradeStrandSections = this.mergeGradeStrandSections(this.gradeStrandSections, firebaseGSS);
                this.updateDropdowns();
                this.updateQuickSelectGrid();
                this.saveGradeStrandSectionsToLocal();
            }
        } catch (error) {
            console.error('Error loading grade-strand-sections:', error);
            this.showToast('Error loading options. Using local data.', 'error');
        }
    }

    mergeGradeStrandSections(local, firebase) {
        const merged = [...local];
        
        firebase.forEach(fbEntry => {
            const existingIndex = merged.findIndex(entry => 
                entry.grade === fbEntry.grade && 
                entry.strand === fbEntry.strand && 
                entry.section === fbEntry.section
            );
            if (existingIndex === -1) {
                merged.push(fbEntry);
            } else {
                merged[existingIndex] = fbEntry;
            }
        });

        return merged.sort((a, b) => {
            if (a.grade !== b.grade) return a.grade - b.grade;
            if (a.strand !== b.strand) return a.strand.localeCompare(b.strand);
            return a.section.localeCompare(b.section);
        });
    }

    updateDropdowns() {
        // Update manual form dropdowns
        const gradeSelect = document.getElementById('grade');
        const strandSelect = document.getElementById('strand');
        const sectionSelect = document.getElementById('section');

        // Clear existing options (except first option)
        gradeSelect.innerHTML = '<option value="">Select Grade</option>';
        strandSelect.innerHTML = '<option value="">Select Strand</option>';
        sectionSelect.innerHTML = '<option value="">Select Section</option>';

        // Get unique values
        const grades = [...new Set(this.gradeStrandSections.map(gss => gss.grade))];
        const strands = [...new Set(this.gradeStrandSections.map(gss => gss.strand))];
        const sections = [...new Set(this.gradeStrandSections.map(gss => gss.section))];

        // Add options
        grades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = `Grade ${grade}`;
            gradeSelect.appendChild(option);
        });

        strands.forEach(strand => {
            const option = document.createElement('option');
            option.value = strand;
            option.textContent = strand;
            strandSelect.appendChild(option);
        });

        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionSelect.appendChild(option);
        });

        // Update filter dropdowns
        this.updateFilterDropdowns();
    }

    updateFilterDropdowns() {
        const gradeFilter = this.elements.gradeFilter;
        const strandFilter = this.elements.strandFilter;
        const sectionFilter = this.elements.sectionFilter;

        // Clear existing options (except first option)
        gradeFilter.innerHTML = '<option value="">All Grades</option>';
        strandFilter.innerHTML = '<option value="">All Strands</option>';
        sectionFilter.innerHTML = '<option value="">All Sections</option>';

        // Get unique values
        const grades = [...new Set(this.gradeStrandSections.map(gss => gss.grade))];
        const strands = [...new Set(this.gradeStrandSections.map(gss => gss.strand))];
        const sections = [...new Set(this.gradeStrandSections.map(gss => gss.section))];

        // Add options
        grades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = `Grade ${grade}`;
            gradeFilter.appendChild(option);
        });

        strands.forEach(strand => {
            const option = document.createElement('option');
            option.value = strand;
            option.textContent = strand;
            strandFilter.appendChild(option);
        });

        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionFilter.appendChild(option);
        });
    }

    updateQuickSelectGrid() {
        this.elements.quickSelectGrid.innerHTML = '';

        this.gradeStrandSections.forEach(gss => {
            const button = document.createElement('button');
            button.className = 'quick-select-btn';
            button.dataset.grade = gss.grade;
            button.dataset.strand = gss.strand;
            button.dataset.section = gss.section;
            
            button.innerHTML = `
                <span class="grade">${gss.grade}</span>
                <span class="strand">${gss.strand}</span>
                <span class="section">${gss.section}</span>
                <button class="delete-option" onclick="app.openDeleteModal('${gss.grade}', '${gss.strand}', '${gss.section}')">
                    <i class="fas fa-times"></i>
                </button>
            `;

            button.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-option')) {
                    this.handleQuickSelect(gss);
                }
            });

            this.elements.quickSelectGrid.appendChild(button);
        });
    }

    openManagementModal() {
        const modal = this.elements.managementModal;
        
        // Clear form fields before opening
        document.getElementById('newGrade').value = '';
        document.getElementById('newStrand').value = '';
        document.getElementById('newSection').value = '';
        
        // Reset the entire form
        this.elements.managementForm.reset();
        
        modal.style.display = 'block';
        
        // Force reflow and add show class
        modal.offsetHeight;
        setTimeout(() => {
            modal.classList.add('show');
        }, 50);
        
        // Focus on the first input
        setTimeout(() => {
            document.getElementById('newGrade').focus();
        }, 100);
    }

    openManualEntryModal() {
        const modal = this.elements.manualEntryModal;
        
        // Clear form fields before opening
        document.getElementById('fullName').value = '';
        document.getElementById('grade').value = '';
        document.getElementById('strand').value = '';
        document.getElementById('section').value = '';
        
        // Reset the entire form
        this.elements.manualForm.reset();
        
        modal.style.display = 'block';
        
        // Force reflow and add show class
        modal.offsetHeight;
        setTimeout(() => {
            modal.classList.add('show');
        }, 50);
        
        // Focus on the first input
        setTimeout(() => {
            document.getElementById('fullName').focus();
        }, 100);
    }

    async handleManagementSubmit(e) {
        e.preventDefault();
        
        const grade = parseInt(document.getElementById('newGrade').value);
        const strand = document.getElementById('newStrand').value.trim();
        const section = document.getElementById('newSection').value.trim();

        // Check if combination already exists
        const exists = this.gradeStrandSections.some(gss => 
            gss.grade === grade && gss.strand === strand && gss.section === section
        );

        if (exists) {
            this.showToast('This combination already exists!', 'error');
            return;
        }

        const newGSS = { grade, strand, section };

        try {
            // Clear form fields immediately
            document.getElementById('newGrade').value = '';
            document.getElementById('newStrand').value = '';
            document.getElementById('newSection').value = '';
            
            // Reset the entire form
            e.target.reset();
            
            // Close modal immediately after clearing fields
            this.closeModal();
            
            // Add to local data
            this.gradeStrandSections.push(newGSS);
            this.gradeStrandSections.sort((a, b) => {
                if (a.grade !== b.grade) return a.grade - b.grade;
                if (a.strand !== b.strand) return a.strand.localeCompare(b.strand);
                return a.section.localeCompare(b.section);
            });

            this.updateDropdowns();
            this.updateQuickSelectGrid();
            this.saveGradeStrandSectionsToLocal();

            // Save to Firebase
            if (this.isOnline && this.db && this.firebase) {
                const docId = `${grade}-${strand}-${section}`;
                const docRef = this.firebase.doc(this.db, 'gradeStrandSections', docId);
                await this.firebase.setDoc(docRef, newGSS);
            } else {
                this.pendingSync.push({ ...newGSS, action: 'add', collection: 'gradeStrandSections' });
            }
            
            // Show success modal after a brief delay to ensure management modal is closed
            setTimeout(() => {
                this.showOptionAddedSuccessModal(newGSS);
            }, 200);

        } catch (error) {
            console.error('Error adding option:', error);
            this.showToast('Error adding option. Please try again.', 'error');
        }
    }

    async performDelete(grade, strand, section) {
        try {
            // Remove from local data
            this.gradeStrandSections = this.gradeStrandSections.filter(gss => 
                !(gss.grade === parseInt(grade) && gss.strand === strand && gss.section === section)
            );

            this.updateDropdowns();
            this.updateQuickSelectGrid();
            this.saveGradeStrandSectionsToLocal();

            // Delete from Firebase
            if (this.isOnline && this.db && this.firebase) {
                const docId = `${grade}-${strand}-${section}`;
                const docRef = this.firebase.doc(this.db, 'gradeStrandSections', docId);
                await this.firebase.deleteDoc(docRef);
                this.showToast('Option deleted successfully!', 'success');
            } else {
                this.pendingSync.push({ 
                    grade: parseInt(grade), 
                    strand, 
                    section, 
                    action: 'delete', 
                    collection: 'gradeStrandSections' 
                });
                this.showToast('Option deleted locally. Will sync when online.', 'info');
            }
        } catch (error) {
            console.error('Error deleting option:', error);
            this.showToast('Error deleting option. Please try again.', 'error');
        }
    }

    // Legacy function - now redirects to modal-based approach
    async deleteGradeStrandSection(grade, strand, section) {
        // Use the new modal-based confirmation instead of browser confirm
        this.openDeleteModal(grade, strand, section);
    }

    saveGradeStrandSectionsToLocal() {
        localStorage.setItem('gradeStrandSections', JSON.stringify(this.gradeStrandSections));
    }

    async handleManualSubmit(e) {
        e.preventDefault();
        console.log('Manual submit triggered');
        
        // Get form data directly from input fields
        const fullNameInput = document.getElementById('fullName');
        const gradeInput = document.getElementById('grade');
        const strandInput = document.getElementById('strand');
        const sectionInput = document.getElementById('section');
        
        const rawFullName = fullNameInput ? fullNameInput.value : '';
        const grade = gradeInput ? gradeInput.value : '';
        const strand = strandInput ? strandInput.value : '';
        const section = sectionInput ? sectionInput.value : '';
        
        console.log('Form values:', { rawFullName, grade, strand, section });
        
        // Capitalize the first letter of the name
        const capitalizedFullName = this.capitalizeName(rawFullName);
        
        const entry = {
            fullName: capitalizedFullName,
            grade: grade,
            strand: strand,
            section: section,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };

        console.log('Created entry:', entry);

        // Clear form fields and close modal immediately after form submission
        console.log('Clearing form and closing modal after submission');
        
        // Clear form fields immediately
        document.getElementById('fullName').value = '';
        document.getElementById('grade').value = '';
        document.getElementById('strand').value = '';
        document.getElementById('section').value = '';
        
        // Reset the form
        this.elements.manualForm.reset();
        
        // Close the modal
        this.closeModal();

        // Check for duplicate entry today
        const duplicateCheck = this.checkDuplicateEntry(entry);
        console.log('Duplicate check result:', duplicateCheck);
        
        if (duplicateCheck.isDuplicate) {
            // Show duplicate confirmation modal
            console.log('Showing duplicate modal');
            this.showDuplicateModal(entry, duplicateCheck);
        } else {
            // Add entry directly
            console.log('Adding entry directly');
            const addResult = await this.addEntry(entry);
            console.log('Add entry result:', addResult);
            
            if (addResult) {
                console.log('Entry added successfully');
                console.log('Showing first entry success');
                this.showFirstEntrySuccess(entry);
            } else {
                console.log('Failed to add entry');
                this.showToast('Failed to add entry. Please try again.', 'error');
            }
        }
    }

    async handleQuickSelect(gss) {
        const entry = {
            fullName: 'Quick Entry',
            grade: gss.grade.toString(),
            strand: gss.strand,
            section: gss.section,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };

        // Check for duplicate entry today
        const duplicateCheck = this.checkDuplicateEntry(entry);
        
        if (duplicateCheck.isDuplicate) {
            // Show duplicate confirmation modal
            this.showDuplicateModal(entry, duplicateCheck);
        } else {
            // Add entry directly
            const addResult = await this.addEntry(entry);
            if (addResult) {
                this.showFirstEntrySuccess(entry);
            } else {
                this.showToast('Failed to add entry. Please try again.', 'error');
            }
        }
    }

    async addEntry(entry) {
        try {
            console.log('Adding entry:', entry);
            console.log('Current data length before:', this.data.length);
            
            // Add to local data
            this.data.unshift(entry);
            this.filteredData.unshift(entry);
            
            console.log('Data length after adding:', this.data.length);
            
            // Update UI
            this.renderTable();
            this.updateSummary();
            
            // Save to Firebase
            if (this.isOnline && this.db && this.firebase) {
                console.log('Saving to Firebase...');
                const docRef = this.firebase.doc(this.db, 'tardiness', entry.id);
                await this.firebase.setDoc(docRef, entry);
                console.log('Saved to Firebase successfully');
            } else {
                console.log('Offline - saving to pending sync');
                // Store for sync when online
                this.pendingSync.push(entry);
            }

            // Save to localStorage as backup
            this.saveToLocalStorage();
            
            console.log('Entry added successfully. Total entries:', this.data.length);
            return true;
            
        } catch (error) {
            console.error('Error adding entry:', error);
            this.showToast('Error adding entry. Please try again.', 'error');
            return false;
        }
    }

    async loadData() {
        try {
            console.log('Loading data...');
            // Load from localStorage first
            this.loadDataFromLocalStorage();

            // Load from Firebase if online
            if (this.isOnline && this.db && this.firebase) {
                console.log('Loading from Firebase...');
                const tardinessRef = this.firebase.collection(this.db, 'tardiness');
                const q = this.firebase.query(tardinessRef, this.firebase.orderBy('timestamp', 'desc'));
                const snapshot = await this.firebase.getDocs(q);
                const firebaseData = snapshot.docs.map(doc => doc.data());
                console.log('Loaded from Firebase:', firebaseData.length, 'entries');
                
                // Merge with local data
                this.data = this.mergeData(this.data, firebaseData);
                this.filteredData = [...this.data];
                this.renderTable();
                this.updateSummary();
                this.saveToLocalStorage();
            } else {
                console.log('Offline - using local data only');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error loading data. Using local data.', 'error');
            this.loadDataFromLocalStorage();
        }
    }

    loadDataFromLocalStorage() {
        try {
            const localData = localStorage.getItem('tardinessData');
            console.log('Loading from localStorage:', localData);
            if (localData) {
                this.data = JSON.parse(localData);
                this.filteredData = [...this.data];
                this.renderTable();
                this.updateSummary();
                console.log('Data loaded from localStorage:', this.data.length, 'entries');
            } else {
                console.log('No data found in localStorage');
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this.data = [];
            this.filteredData = [];
        }
    }

    mergeData(localData, firebaseData) {
        const merged = [...localData];
        
        firebaseData.forEach(fbEntry => {
            const existingIndex = merged.findIndex(entry => entry.id === fbEntry.id);
            if (existingIndex === -1) {
                merged.unshift(fbEntry);
            } else {
                merged[existingIndex] = fbEntry;
            }
        });

        return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    filterData() {
        const searchTerm = this.elements.searchInput.value.toLowerCase();
        const gradeFilter = this.elements.gradeFilter.value;
        const strandFilter = this.elements.strandFilter.value;
        const sectionFilter = this.elements.sectionFilter.value;
        const sortOrder = this.elements.sortOrder.value;

        this.filteredData = this.data.filter(entry => {
            const matchesSearch = !searchTerm || 
                entry.fullName.toLowerCase().includes(searchTerm) ||
                entry.grade.toString().includes(searchTerm) ||
                entry.strand.toLowerCase().includes(searchTerm) ||
                entry.section.toLowerCase().includes(searchTerm);

            const matchesGrade = !gradeFilter || entry.grade.toString() === gradeFilter;
            const matchesStrand = !strandFilter || entry.strand === strandFilter;
            const matchesSection = !sectionFilter || entry.section === sectionFilter;

            return matchesSearch && matchesGrade && matchesStrand && matchesSection;
        });

        // Sort data
        this.filteredData.sort((a, b) => {
            const dateA = new Date(a.timestamp);
            const dateB = new Date(b.timestamp);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        this.renderTable();
    }

    renderTable() {
        this.elements.tableBody.innerHTML = '';

        this.filteredData.forEach(entry => {
            const row = document.createElement('tr');
            
            // Calculate today's late count for this student
            const todayLateCount = this.getTodayLateCount(entry);
            const lateCountBadge = todayLateCount > 1 ? `<span class="late-count-badge">Late x${todayLateCount}</span>` : '';
            
            row.innerHTML = `
                <td>
                    ${entry.fullName}
                    ${lateCountBadge}
                </td>
                <td>${entry.grade}</td>
                <td>${entry.strand}</td>
                <td>${entry.section}</td>
                <td>${new Date(entry.timestamp).toLocaleString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="app.editEntry('${entry.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete-btn" onclick="app.deleteEntry('${entry.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            this.elements.tableBody.appendChild(row);
        });
    }

    getTodayLateCount(entry) {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        return this.data.filter(dataEntry => {
            const entryDate = new Date(dataEntry.timestamp);
            return entryDate >= todayStart && 
                   entryDate < todayEnd &&
                   dataEntry.fullName.toLowerCase() === entry.fullName.toLowerCase() &&
                   dataEntry.grade === entry.grade &&
                   dataEntry.strand === entry.strand &&
                   dataEntry.section === entry.section;
        }).length;
    }

    updateSummary() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

        const todayCount = this.data.filter(entry => new Date(entry.timestamp) >= today).length;
        const weekCount = this.data.filter(entry => new Date(entry.timestamp) >= weekAgo).length;
        const monthCount = this.data.filter(entry => new Date(entry.timestamp) >= monthAgo).length;

        this.elements.todayCount.textContent = todayCount;
        this.elements.weekCount.textContent = weekCount;
        this.elements.monthCount.textContent = monthCount;
    }

    async editEntry(id) {
        const entry = this.data.find(item => item.id === id);
        if (!entry) return;

        // Populate modal
        document.getElementById('editFullName').value = entry.fullName;
        document.getElementById('editGrade').value = entry.grade;
        document.getElementById('editStrand').value = entry.strand;
        document.getElementById('editSection').value = entry.section;

        // Update edit modal dropdowns
        this.updateEditModalDropdowns();

        // Store entry ID for update
        this.elements.editForm.dataset.entryId = id;

        // Show modal
        const modal = this.elements.editModal;
        modal.style.display = 'block';
        
        // Force reflow and add show class
        modal.offsetHeight;
        setTimeout(() => {
            modal.classList.add('show');
        }, 50);
    }

    updateEditModalDropdowns() {
        const editGrade = document.getElementById('editGrade');
        const editStrand = document.getElementById('editStrand');
        const editSection = document.getElementById('editSection');

        // Clear existing options
        editGrade.innerHTML = '';
        editStrand.innerHTML = '';
        editSection.innerHTML = '';

        // Get unique values
        const grades = [...new Set(this.gradeStrandSections.map(gss => gss.grade))];
        const strands = [...new Set(this.gradeStrandSections.map(gss => gss.strand))];
        const sections = [...new Set(this.gradeStrandSections.map(gss => gss.section))];

        // Add options
        grades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = `Grade ${grade}`;
            editGrade.appendChild(option);
        });

        strands.forEach(strand => {
            const option = document.createElement('option');
            option.value = strand;
            option.textContent = strand;
            editStrand.appendChild(option);
        });

        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            editSection.appendChild(option);
        });
    }

    async handleEditSubmit(e) {
        e.preventDefault();
        
        const entryId = e.target.dataset.entryId;
        
        // Read all form values BEFORE closing the modal
        const rawFullName = document.getElementById('editFullName').value;
        const grade = document.getElementById('editGrade').value;
        const strand = document.getElementById('editStrand').value;
        const section = document.getElementById('editSection').value;
        
        // Close modal immediately after reading values
        console.log('Save Changes clicked, closing edit modal immediately...');
        this.closeModal();
        
        // Capitalize the first letter of the name
        const capitalizedFullName = this.capitalizeName(rawFullName);
        
        const updatedEntry = {
            fullName: capitalizedFullName,
            grade: grade,
            strand: strand,
            section: section,
            timestamp: new Date().toISOString(),
            id: entryId
        };

        try {
            // Update local data
            const index = this.data.findIndex(entry => entry.id === entryId);
            if (index !== -1) {
                this.data[index] = updatedEntry;
                this.saveToLocalStorage();
                this.filterData();
                this.updateSummary();
            }

            // Update Firebase
            if (this.isOnline && this.db && this.firebase) {
                const docRef = this.firebase.doc(this.db, 'tardiness', entryId);
                await this.firebase.updateDoc(docRef, updatedEntry);
                this.showToast('Entry updated successfully!', 'success');
            } else {
                this.pendingSync.push({ ...updatedEntry, action: 'update' });
                this.showToast('Entry updated locally. Will sync when online.', 'info');
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            this.showToast('Error updating entry. Please try again.', 'error');
        }
    }

    async deleteEntry(id) {
        // Show custom delete confirmation modal instead of native confirm
        this.showDeleteConfirmationModal(id);
    }

    showDeleteConfirmationModal(id) {
        const entryToDelete = this.data.find(entry => entry.id === id);
        if (!entryToDelete) return;

        const modal = document.createElement('div');
        modal.className = 'modal delete-confirmation-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-trash-alt"></i> Confirm Delete</h2>
                </div>
                <div class="modal-body">
                    <div class="delete-details">
                        <p>Are you sure you want to delete this entry?</p>
                        <p><strong>Student:</strong> ${entryToDelete.fullName}</p>
                        <p><strong>Grade-Strand-Section:</strong> ${entryToDelete.grade} ${entryToDelete.strand} ${entryToDelete.section}</p>
                        <p><strong>Time Recorded:</strong> ${new Date(entryToDelete.timestamp).toLocaleTimeString()}</p>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="cancel-btn" onclick="app.closeDeleteConfirmationModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="delete-btn" onclick="app.confirmDeleteEntry('${id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Show the modal using the CSS class
        setTimeout(() => {
            modal.classList.add('show');
            console.log('Delete confirmation modal should now be visible');
        }, 50);
    }

    closeDeleteConfirmationModal() {
        console.log('Closing delete confirmation modal immediately...');
        const modal = document.querySelector('.delete-confirmation-modal');
        if (modal) {
            console.log('Delete confirmation modal found, removing immediately...');
            modal.classList.remove('show');
            // Remove immediately for faster response
            modal.style.display = 'none';
            // Remove from DOM after a short delay for cleanup
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                    console.log('Delete confirmation modal removed from DOM');
                }
            }, 50);
        } else {
            console.log('No delete confirmation modal found to close');
        }
    }

    async confirmDeleteEntry(id) {
        try {
            // Close confirmation modal IMMEDIATELY when delete button is clicked
            console.log('Delete button clicked, closing modal immediately...');
            this.closeDeleteConfirmationModal();
            
            // Find the entry before deleting for the success modal
            const entryToDelete = this.data.find(entry => entry.id === id);
            
            // Remove from local data
            this.data = this.data.filter(entry => entry.id !== id);
            this.saveToLocalStorage();
            this.filterData();
            this.updateSummary();

            // Delete from Firebase
            if (this.isOnline && this.db && this.firebase) {
                const docRef = this.firebase.doc(this.db, 'tardiness', id);
                await this.firebase.deleteDoc(docRef);
            } else {
                this.pendingSync.push({ id, action: 'delete' });
            }
            
            // Show delete success modal after processing
            if (entryToDelete) {
                console.log('Showing delete success modal...');
                this.showDeleteSuccessModal(entryToDelete);
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            this.showToast('Error deleting entry. Please try again.', 'error');
            this.closeDeleteConfirmationModal();
        }
    }

    closeModal() {
        console.log('Closing modals...');
        
        // Close specific modal types
        const editModal = this.elements.editModal;
        const managementModal = this.elements.managementModal;
        const manualEntryModal = this.elements.manualEntryModal;
        
        if (editModal && editModal.style.display === 'block') {
            console.log('Closing edit modal...');
            editModal.classList.remove('show');
            setTimeout(() => {
                editModal.style.display = 'none';
            }, 300);
        }
        
        if (managementModal && managementModal.style.display === 'block') {
            console.log('Closing management modal...');
            managementModal.classList.remove('show');
            setTimeout(() => {
                managementModal.style.display = 'none';
                // Clear management form fields explicitly when closing
                document.getElementById('newGrade').value = '';
                document.getElementById('newStrand').value = '';
                document.getElementById('newSection').value = '';
            }, 300);
        }
        
        if (manualEntryModal && manualEntryModal.style.display === 'block') {
            console.log('Closing manual entry modal...');
            manualEntryModal.classList.remove('show');
            setTimeout(() => {
                manualEntryModal.style.display = 'none';
                // Clear manual entry form fields explicitly when closing
                document.getElementById('fullName').value = '';
                document.getElementById('grade').value = '';
                document.getElementById('strand').value = '';
                document.getElementById('section').value = '';
            }, 300);
        }
        
        // Close any dynamic modals (but preserve success modals)
        document.querySelectorAll('.modal:not(#editModal):not(#managementModal):not(#manualEntryModal):not(.success-modal)').forEach(modal => {
            console.log('Closing dynamic modal:', modal.className);
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        });
        
        // Reset forms
        if (this.elements.editForm) this.elements.editForm.reset();
        if (this.elements.managementForm) {
            this.elements.managementForm.reset();
            // Double-check that fields are cleared
            setTimeout(() => {
                document.getElementById('newGrade').value = '';
                document.getElementById('newStrand').value = '';
                document.getElementById('newSection').value = '';
            }, 50);
        }
        
        console.log('Modal closing completed');
    }

    // Export Functions
    exportToExcel() {
        const exportData = this.filteredData.map(entry => ({
            'Full Name': entry.fullName,
            'Grade': entry.grade,
            'Strand': entry.strand,
            'Section': entry.section,
            'Date & Time': new Date(entry.timestamp).toLocaleString()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tardiness Data');
        
        const fileName = `tardiness_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        this.showToast('Excel file exported successfully!', 'success');
    }

    async exportToPDF() {
        try {
            console.log('Starting PDF export...');
            
            // Show loading message
            this.showToast('Generating PDF report...', 'info');
            
            // Check if jsPDF is available
            if (!window.jspdf) {
                throw new Error('jsPDF library not loaded');
            }
            
            const { jsPDF } = window.jspdf;
            
            if (!jsPDF) {
                throw new Error('jsPDF constructor not available');
            }
            
            console.log('jsPDF loaded successfully');
            const doc = new jsPDF();

            // Get date range info
            const dateInfo = this.getCurrentDateRangeInfo();
            
            // Add school logo (if available and enabled)
            const includeLogo = !this.exportOptions || this.exportOptions.includeLogo;
            if (includeLogo) {
                try {
                    const logoImg = new Image();
                    logoImg.crossOrigin = 'anonymous';
                    logoImg.src = '/logo/comsite-logo-trans.png'; // Use absolute path for Vercel
                    await new Promise((resolve) => {
                        logoImg.onload = () => {
                            console.log('Logo loaded for PDF');
                            // Add logo as watermark in center with better visibility
                            doc.addImage(logoImg, 'PNG', 75, 90, 60, 60, '', 'NONE', 0.2);
                            resolve();
                        };
                        logoImg.onerror = (error) => {
                            console.log('Logo not loaded for PDF export:', error);
                            resolve(); // Continue even if logo fails
                        };
                        setTimeout(resolve, 2000); // Timeout after 2 seconds
                    });
                } catch (error) {
                    console.log('Logo loading error:', error);
                }
            }

            // Set theme color
            const themeColor = [9, 135, 68]; // #098744 in RGB
            
            // Header
            doc.setTextColor(...themeColor);
            doc.setFontSize(24);
            doc.setFont(undefined, 'bold');
            doc.text('Tardiness Monitoring Report', 105, 30, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setFont(undefined, 'normal');
            doc.text(dateInfo.title, 105, 45, { align: 'center' });

            // Generation info
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 55, { align: 'center' });

            // Check if summary mode is enabled
            const isSummaryMode = this.exportOptions?.contentType === 'summary';
            
            let tableData, headers, dataCount;
            
            if (isSummaryMode) {
                // Summary mode: show section-based late counts
                const summaryData = this.getSummaryDataBySection();
                
                tableData = summaryData.map(entry => [
                    entry.grade,
                    entry.strand,
                    entry.section,
                    entry.count.toString()
                ]);
                
                headers = ['Grade', 'Strand', 'Section', 'Late Count'];
                dataCount = summaryData.reduce((total, entry) => total + entry.count, 0);
            } else {
                // Individual records mode
                const filteredData = this.getFilteredDataForExport();
                const dateTimeColumns = this.exportOptions?.dateTimeColumns || 'both';
                const includeDate = dateTimeColumns === 'both' || dateTimeColumns === 'date';
                const includeTime = dateTimeColumns === 'both' || dateTimeColumns === 'time';
            
            tableData = filteredData.map(entry => {
                const date = new Date(entry.timestamp);
                const row = [
                    entry.fullName,
                    entry.grade,
                    entry.strand,
                    entry.section
                ];
                
                if (includeDate) {
                    row.push(date.toLocaleDateString());
                }
                if (includeTime) {
                    row.push(date.toLocaleTimeString());
                }
                
                return row;
            });

            // Create table headers
            headers = ['Name', 'Grade', 'Strand', 'Section'];
            if (includeDate) {
                headers.push('Date');
            }
            if (includeTime) {
                headers.push('Time');
            }
            dataCount = filteredData.length;
        }

        // Add table
        console.log('Adding table to PDF...');
        
        // Check if autoTable is available
        if (!doc.autoTable) {
            console.warn('autoTable not available, creating simple PDF without table');
            
            // Simple fallback without table
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Export Data:', 20, 80);
            
            // Add simple text data
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            let yPosition = 95;
            
            if (isSummaryMode) {
                const summaryData = this.getSummaryDataBySection();
                doc.text('Summary by Section:', 20, yPosition);
                yPosition += 10;
                
                summaryData.forEach((entry, index) => {
                    if (yPosition > 270) { // Check page height
                        doc.addPage();
                        yPosition = 20;
                    }
                    const text = `${entry.grade} ${entry.strand} - ${entry.section}: ${entry.count} late(s)`;
                    doc.text(text, 20, yPosition);
                    yPosition += 8;
                });
            } else {
                const filteredData = this.getFilteredDataForExport();
                doc.text('Individual Records:', 20, yPosition);
                yPosition += 10;
                
                filteredData.slice(0, 30).forEach((entry, index) => { // Limit to first 30 entries
                    if (yPosition > 270) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    const date = new Date(entry.timestamp);
                    const text = `${entry.fullName} - ${entry.grade} ${entry.strand} ${entry.section} - ${date.toLocaleDateString()}`;
                    doc.text(text, 20, yPosition);
                    yPosition += 8;
                });
                
                if (filteredData.length > 30) {
                    doc.text(`... and ${filteredData.length - 30} more entries`, 20, yPosition + 5);
                }
            }
            
        } else {
            // Use autoTable if available
            doc.autoTable({
                head: [headers],
                body: tableData,
                startY: 70,
                styles: { 
                    fontSize: 9,
                    cellPadding: 4,
                    textColor: [51, 51, 51]
                },
                headStyles: {
                    fillColor: themeColor,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                alternateRowStyles: {
                    fillColor: [248, 249, 250]
                },
                theme: 'striped'
            });
        }

        console.log('Content added successfully');

        // Footer with statistics
        const finalY = doc.autoTable ? (doc.lastAutoTable.finalY + 20) : 250;
        
        doc.setTextColor(...themeColor);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        
        if (isSummaryMode) {
            doc.text(`Total Late Entries: ${dataCount}`, 20, finalY);
            doc.text(`Sections with Late Records: ${tableData.length}`, 20, finalY + 10);
        } else {
            doc.text(`Total Late Entries: ${dataCount}`, 20, finalY);
        }
        
        // Include date/time if enabled
        const includeDateTime = !this.exportOptions || this.exportOptions.includeDateTime;
        if (includeDateTime) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Export Date: ${new Date().toLocaleDateString()} | ${new Date().toLocaleTimeString()}`, 
                     190, finalY + 10, { align: 'right' });
        }

        const fileName = `tardiness_report_${new Date().toISOString().split('T')[0]}.pdf`;
        console.log('Saving PDF as:', fileName);
        doc.save(fileName);
        
        this.showToast('Professional PDF exported successfully!', 'success');
        console.log('PDF export completed successfully');
        
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showToast(`PDF export failed: ${error.message}`, 'error');
            
            // Show more specific error messages
            if (error.message.includes('jsPDF')) {
                this.showToast('PDF library not loaded. Please refresh the page and try again.', 'error');
            } else if (error.message.includes('autoTable')) {
                this.showToast('PDF table plugin not available. Please refresh the page and try again.', 'error');
            }
        }
    }

    async exportToImage() {
        try {
            console.log('Starting image export...');
            
            // Create a professional export container
            const exportContainer = this.createProfessionalExportView();
            if (!exportContainer) {
                throw new Error('Failed to create export container');
            }
            
            document.body.appendChild(exportContainer);
            console.log('Export container added to DOM');
            
            // Wait for images to load
            await this.waitForImages(exportContainer);
            console.log('Images loaded');
            
            // Give extra time for logo to render
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if mobile for different canvas settings
            const isMobile = window.innerWidth <= 768;
            const canvasOptions = {
                backgroundColor: '#ffffff',
                scale: isMobile ? 1.5 : 2, // Lower scale for mobile to prevent memory issues
                width: exportContainer.offsetWidth,
                height: exportContainer.offsetHeight,
                useCORS: true,
                allowTaint: false,
                logging: true,
                imageTimeout: 5000,
                removeContainer: false,
                scrollX: 0,
                scrollY: 0
            };
            
            console.log('Canvas options:', canvasOptions);
            
            const canvas = await html2canvas(exportContainer, canvasOptions);
            
            console.log('Canvas created successfully');
            
            // Remove the temporary container
            document.body.removeChild(exportContainer);
            
            // Create download
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0];
            link.download = `tardiness_report_${timestamp}.png`;
            
            // Convert to blob for better mobile compatibility
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.click();
                
                // Clean up the URL after download
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 'image/png', 0.95);
            
            this.showToast('Professional report exported successfully!', 'success');
            console.log('Image export completed successfully');
            
        } catch (error) {
            console.error('Error exporting image:', error);
            this.showToast(`Export failed: ${error.message}`, 'error');
            
            // Clean up if error occurred
            const existingContainer = document.getElementById('professionalExportContainer');
            if (existingContainer && existingContainer.parentNode) {
                existingContainer.parentNode.removeChild(existingContainer);
            }
        }
    }

    createProfessionalExportView() {
        const container = document.createElement('div');
        container.id = 'professionalExportContainer';
        
        // Check if we're on mobile
        const isMobile = window.innerWidth <= 768;
        const containerWidth = isMobile ? '600px' : '800px';
        const padding = isMobile ? '20px' : '40px';
        
        container.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: ${containerWidth};
            min-height: ${isMobile ? '400px' : '600px'};
            background: #ffffff;
            font-family: 'Poppins', 'Segoe UI', sans-serif;
            padding: ${padding};
            box-sizing: border-box;
        `;

        // Get current date range info
        const dateInfo = this.getCurrentDateRangeInfo();
        
        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            text-align: center;
            margin-bottom: 30px;
            position: relative;
            z-index: 2;
        `;
        
        // Add school logo as background watermark (if enabled)
        if (!this.exportOptions || this.exportOptions.includeLogo) {
            const logoSize = isMobile ? '250px' : '400px';
            const logoTop = isMobile ? '80px' : '150px';
            
            // Create logo watermark container
            const logoWatermark = document.createElement('div');
            logoWatermark.style.cssText = `
                position: absolute;
                top: ${logoTop};
                left: 50%;
                transform: translateX(-50%);
                width: ${logoSize};
                height: ${logoSize};
                z-index: 0;
                pointer-events: none;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isMobile ? '12px' : '14px'};
                color: rgba(9, 135, 68, 0.3);
                text-align: center;
            `;
            
            // Try to load the image, fallback to text if fails
            const logoImg = document.createElement('img');
            logoImg.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                opacity: 0.3;
            `;
            
            logoImg.onload = () => {
                console.log('✅ Logo image loaded successfully for watermark');
                logoWatermark.innerHTML = ''; // Clear any fallback text
                logoWatermark.appendChild(logoImg);
            };
            
            logoImg.onerror = () => {
                console.error('❌ Logo image failed to load, using text fallback');
                logoWatermark.innerHTML = 'SCHOOL LOGO<br>WATERMARK';
            };
            
            // Use absolute path for Vercel deployment
            logoImg.src = '/logo/comsite-logo-trans.png';
            
            // Set initial fallback text
            logoWatermark.innerHTML = 'LOADING LOGO...';
            
            container.appendChild(logoWatermark);
            console.log('Logo watermark container added to export');
        }
        
        // Determine if this is summary mode
        const isSummaryMode = this.exportOptions?.contentType === 'summary';
        const reportTitle = isSummaryMode ? 'Summary of Lates by Section' : 'Tardiness Monitoring Report';
        
        header.innerHTML = `
            <h1 style="color: #098744; font-size: ${isMobile ? '22px' : '28px'}; font-weight: 700; margin: 0 0 ${isMobile ? '15px' : '20px'} 0;">
                ${reportTitle}
            </h1>
            <p style="color: #666; font-size: ${isMobile ? '12px' : '14px'}; margin: 0;">
                Generated on: ${new Date().toLocaleString()}
            </p>
        `;
        
        container.appendChild(header);
        
        // Create table
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            background: rgba(255, 255, 255, 0.75);
            border-radius: 8px;
            padding: ${isMobile ? '15px' : '20px'};
            position: relative;
            z-index: 2;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow-x: auto;
        `;
        
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: ${isMobile ? '10px' : '12px'};
            color: #333;
            min-width: ${isMobile ? '500px' : '600px'};
        `;
        
        // Create table header
        const dateTimeColumns = this.exportOptions?.dateTimeColumns || 'both';
        const isSummary = this.exportOptions?.contentType === 'summary';
        const includeDate = !isSummary && (dateTimeColumns === 'both' || dateTimeColumns === 'date');
        const includeTime = !isSummary && (dateTimeColumns === 'both' || dateTimeColumns === 'time');
        
        let headerCells = '';
        
        if (isSummary) {
            // Summary table headers
            const cellPadding = isMobile ? '8px 4px' : '12px 8px';
            headerCells = `
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Grade</th>
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Strand</th>
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Section</th>
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Total Count</th>
            `;
        } else {
            // Individual records headers
            const cellPadding = isMobile ? '8px 4px' : '12px 8px';
            headerCells = `
                <th style="padding: ${cellPadding}; text-align: left; font-weight: 600; border-bottom: 2px solid #076a35;">Name</th>
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Grade</th>
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Strand</th>
                <th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Section</th>
            `;
            
            if (includeDate) {
                headerCells += `<th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Date</th>`;
            }
            if (includeTime) {
                headerCells += `<th style="padding: ${cellPadding}; text-align: center; font-weight: 600; border-bottom: 2px solid #076a35;">Time</th>`;
            }
        }
        
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr style="background: rgba(9, 135, 68, 0.9); color: white;">${headerCells}</tr>`;
        table.appendChild(thead);
        
        // Create table body with filtered data (no action columns)
        const tbody = document.createElement('tbody');
        
        if (isSummary) {
            // Create summary data grouped by section
            const summaryData = this.getSummaryDataBySection();
            const cellPadding = isMobile ? '6px 4px' : '10px 8px';
            
            summaryData.forEach((entry, index) => {
                const row = document.createElement('tr');
                const isEven = index % 2 === 0;
                row.style.cssText = `
                    background: ${isEven ? 'rgba(248, 249, 250, 0.7)' : 'rgba(255, 255, 255, 0.7)'};
                    border-bottom: 1px solid #ccc;
                `;
                
                row.innerHTML = `
                    <td style="padding: ${cellPadding}; text-align: center; border-right: 1px solid #ccc;">${entry.grade}</td>
                    <td style="padding: ${cellPadding}; text-align: center; border-right: 1px solid #ccc;">${entry.strand}</td>
                    <td style="padding: ${cellPadding}; text-align: center; border-right: 1px solid #ccc;">${entry.section}</td>
                    <td style="padding: ${cellPadding}; text-align: center; font-weight: 600; color: #098744;">${entry.count}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            // Individual records
            const filteredData = this.getFilteredDataForExport();
            const cellPadding = isMobile ? '6px 4px' : '10px 8px';
            
            filteredData.forEach((entry, index) => {
                const row = document.createElement('tr');
                const isEven = index % 2 === 0;
                row.style.cssText = `
                    background: ${isEven ? 'rgba(248, 249, 250, 0.7)' : 'rgba(255, 255, 255, 0.7)'};
                    border-bottom: 1px solid #ccc;
                `;
                
                const date = new Date(entry.timestamp);
                
                let dataCells = `
                    <td style="padding: ${cellPadding}; border-right: 1px solid #ccc;">${entry.fullName}</td>
                    <td style="padding: ${cellPadding}; text-align: center; border-right: 1px solid #ccc;">${entry.grade}</td>
                    <td style="padding: ${cellPadding}; text-align: center; border-right: 1px solid #ccc;">${entry.strand}</td>
                    <td style="padding: ${cellPadding}; text-align: center; ${(!includeDate && !includeTime) ? '' : 'border-right: 1px solid #ccc;'}">${entry.section}</td>
                `;
                
                if (includeDate) {
                    dataCells += `<td style="padding: ${cellPadding}; text-align: center; ${!includeTime ? '' : 'border-right: 1px solid #ccc;'}">${date.toLocaleDateString()}</td>`;
                }
                if (includeTime) {
                    dataCells += `<td style="padding: ${cellPadding}; text-align: center;">${date.toLocaleTimeString()}</td>`;
                }
                
                row.innerHTML = dataCells;
                tbody.appendChild(row);
            });
        }
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        container.appendChild(tableContainer);
        
        // Add footer with statistics
        const footer = document.createElement('div');
        footer.style.cssText = `
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
            z-index: 2;
        `;
        
        const includeDateTime = !this.exportOptions || this.exportOptions.includeDateTime;
        const dateTimeSection = includeDateTime ? 
            `<div style="color: #666; font-size: 12px;">
                Export Date: ${new Date().toLocaleDateString()} | ${new Date().toLocaleTimeString()}
            </div>` : '';
        
        let totalCount;
        let statsText;
        
        if (isSummary) {
            const summaryData = this.getSummaryDataBySection();
            totalCount = summaryData.reduce((total, entry) => total + entry.count, 0);
            statsText = `Total Late Entries: ${totalCount} across all sections | Unique Sections: ${summaryData.length}`;
        } else {
            const filteredData = this.getFilteredDataForExport();
            totalCount = filteredData.length;
            statsText = `Total Late Entries: ${totalCount}`;
        }
        
        footer.innerHTML = `
            <div style="color: #098744; font-weight: 600; font-size: 14px;">
                ${statsText}
            </div>
            ${dateTimeSection}
        `;
        
        container.appendChild(footer);
        
        return container;
    }

    getCurrentDateRangeInfo() {
        // This will be enhanced when we add the modal
        // For now, return a default based on current date
        const today = new Date();
        return {
            title: `Tardiness for Today - ${today.toLocaleDateString()}`,
            range: 'today'
        };
    }

    getFilteredDataForExport() {
        // Return filtered data without any action-related properties
        return this.filteredData.map(entry => ({
            fullName: entry.fullName,
            grade: entry.grade,
            strand: entry.strand,
            section: entry.section,
            timestamp: entry.timestamp
        }));
    }

    async waitForImages(container) {
        const images = container.querySelectorAll('img');
        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if image fails to load
                setTimeout(resolve, 3000); // Timeout after 3 seconds
            });
        });
        await Promise.all(promises);
    }

    // Export Modal Functions
    openExportModal() {
        console.log('Opening export modal...');
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Reset form to defaults
            this.resetExportForm();
            
            // Re-initialize modal each time it opens to ensure all event listeners work
            this.initializeExportModalListeners();
            
            // Add click-outside-to-close functionality
            modal.onclick = (e) => {
                if (e.target === modal) {
                    this.closeExportModal();
                }
            };
            
            console.log('Export modal opened and reinitialized');
        } else {
            console.error('Export modal not found in DOM');
            // Try to find modal after a short delay in case DOM isn't ready
            setTimeout(() => {
                const retryModal = document.getElementById('exportModal');
                if (retryModal) {
                    this.openExportModal();
                } else {
                    console.error('Export modal still not found after retry');
                    this.showToast('Export modal not available. Please refresh the page.', 'error');
                }
            }, 100);
        }
    }

    resetExportForm() {
        // Reset content type to individual
        const individualRadio = document.querySelector('input[name="contentType"][value="individual"]');
        if (individualRadio) {
            individualRadio.checked = true;
        }
        
        // Reset date range to today
        const todayRadio = document.querySelector('input[name="dateRange"][value="today"]');
        if (todayRadio) {
            todayRadio.checked = true;
        }
        
        // Reset date/time columns to both
        const bothRadio = document.querySelector('input[name="dateTimeColumns"][value="both"]');
        if (bothRadio) {
            bothRadio.checked = true;
        }
    }

    initializeExportModal() {
        // Wait for DOM to be fully loaded
        setTimeout(() => {
            this.initializeExportModalListeners();
        }, 100);
    }

    initializeExportModalListeners() {
        try {
            console.log('Initializing export modal listeners...');
            
            // Remove existing event listeners to prevent duplicates
            this.removeExportModalListeners();
            
            // Handle date range selection
            const dateRangeInputs = document.querySelectorAll('input[name="dateRange"]');
            const customDateRange = document.getElementById('customDateRange');
            
            if (dateRangeInputs.length === 0) {
                console.log('Export modal inputs not found yet');
                return;
            }
            
            // Store listeners for later removal
            this.dateRangeListeners = [];
            
            dateRangeInputs.forEach(input => {
                const listener = () => {
                    if (input.value === 'custom') {
                        if (customDateRange) customDateRange.style.display = 'block';
                    } else {
                        if (customDateRange) customDateRange.style.display = 'none';
                    }
                };
                input.addEventListener('change', listener);
                this.dateRangeListeners.push({ element: input, listener });
            });

            // Handle format buttons
            const formatButtons = document.querySelectorAll('.format-btn');
            this.formatButtonListeners = [];
            
            formatButtons.forEach(btn => {
                const listener = () => {
                    const format = btn.dataset.format;
                    this.handleExportWithOptions(format);
                };
                btn.addEventListener('click', listener);
                this.formatButtonListeners.push({ element: btn, listener });
            });

            // Set default dates for custom range
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            
            if (startDateInput && endDateInput) {
                startDateInput.value = today.toISOString().split('T')[0];
                endDateInput.value = tomorrow.toISOString().split('T')[0];
            }
            
            console.log('Export modal listeners initialized successfully');
        } catch (error) {
            console.error('Error initializing export modal listeners:', error);
        }
    }

    closeExportModal() {
        console.log('Closing export modal...');
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'none';
            console.log('Export modal closed');
        }
    }

    // Delete Modal Functions
    openDeleteModal(grade, strand, section) {
        console.log('Opening delete modal for:', grade, strand, section);
        
        // Store the details for confirmation
        this.pendingDelete = { grade, strand, section };
        
        // Update modal content
        const deleteMessage = document.getElementById('deleteMessage');
        const deleteDetails = document.getElementById('deleteDetails');
        
        if (deleteMessage) {
            deleteMessage.textContent = 'Are you sure you want to delete this grade-strand-section combination?';
        }
        
        if (deleteDetails) {
            deleteDetails.textContent = `Grade ${grade} ${strand} ${section}`;
        }
        
        // Show the modal
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeDeleteModal() {
        console.log('Closing delete modal...');
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Clear pending delete data
        this.pendingDelete = null;
    }

    async confirmDelete() {
        if (!this.pendingDelete) {
            console.error('No pending delete operation');
            return;
        }

        const { grade, strand, section } = this.pendingDelete;
        
        try {
            // Close the modal first
            this.closeDeleteModal();
            
            // Perform the actual deletion
            await this.performDelete(grade, strand, section);
            
            console.log('Delete operation completed successfully');
        } catch (error) {
            console.error('Error during delete confirmation:', error);
            this.showToast('Error deleting option. Please try again.', 'error');
        }
    }

    removeExportModalListeners() {
        // Remove date range listeners
        if (this.dateRangeListeners) {
            this.dateRangeListeners.forEach(({ element, listener }) => {
                element.removeEventListener('change', listener);
            });
            this.dateRangeListeners = [];
        }
        
        // Remove format button listeners
        if (this.formatButtonListeners) {
            this.formatButtonListeners.forEach(({ element, listener }) => {
                element.removeEventListener('click', listener);
            });
            this.formatButtonListeners = [];
        }
    }

    handleExportWithOptions(format) {
        try {
            console.log('Starting export with format:', format);
            
            // Get selected options with fallbacks
            const selectedRangeElement = document.querySelector('input[name="dateRange"]:checked');
            const selectedRange = selectedRangeElement ? selectedRangeElement.value : 'today';
            
            const logoElement = document.getElementById('includeLogo');
            const includeLogo = logoElement ? logoElement.checked : true;
            
            const dateTimeElement = document.getElementById('includeDateTime');
            const includeDateTime = dateTimeElement ? dateTimeElement.checked : true;
            
            // Get date/time column options
            const dateTimeColumnsElement = document.querySelector('input[name="dateTimeColumns"]:checked');
            const dateTimeColumns = dateTimeColumnsElement ? dateTimeColumnsElement.value : 'both';

            console.log('Export options:', { selectedRange, includeLogo, includeDateTime, dateTimeColumns });

            // Store export options
            this.exportOptions = {
                dateRange: selectedRange,
                includeLogo,
                includeDateTime,
                dateTimeColumns, // 'both', 'date', 'time', 'none', 'summary'
                contentType: dateTimeColumns === 'summary' ? 'summary' : 'individual',
                startDate: document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0],
                endDate: document.getElementById('endDate')?.value || new Date().toISOString().split('T')[0]
            };

            // Close modal
            const modal = document.getElementById('exportModal');
            if (modal) {
                modal.style.display = 'none';
            }

            console.log('Calling export function for format:', format);

            // Export based on format
            if (format === 'image') {
                this.exportToImage();
            } else if (format === 'pdf') {
                this.exportToPDF();
            }
        } catch (error) {
            console.error('Error in handleExportWithOptions:', error);
            alert('Error processing export options: ' + error.message);
        }
    }

    getCurrentDateRangeInfo() {
        if (!this.exportOptions) {
            const today = new Date();
            return {
                title: `Tardiness for Today - ${today.toLocaleDateString()}`,
                range: 'today'
            };
        }

        const { dateRange, startDate, endDate } = this.exportOptions;
        const today = new Date();

        switch (dateRange) {
            case 'today':
                return {
                    title: `Tardiness for Today - ${today.toLocaleDateString()}`,
                    range: 'today'
                };
            case 'week':
                const monday = new Date(today);
                monday.setDate(today.getDate() - today.getDay() + 1);
                const saturday = new Date(monday);
                saturday.setDate(monday.getDate() + 5);
                return {
                    title: `Tardiness This Week - ${monday.toLocaleDateString()} to ${saturday.toLocaleDateString()}`,
                    range: 'week'
                };
            case 'month':
                const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return {
                    title: `Tardiness for ${monthName}`,
                    range: 'month'
                };
            case 'custom':
                return {
                    title: `Tardiness Report - ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
                    range: 'custom'
                };
            default:
                return {
                    title: `Tardiness for Today - ${today.toLocaleDateString()}`,
                    range: 'today'
                };
        }
    }

    getFilteredDataForExport() {
        if (!this.exportOptions) {
            return this.filteredData.map(entry => ({
                fullName: entry.fullName,
                grade: entry.grade,
                strand: entry.strand,
                section: entry.section,
                timestamp: entry.timestamp
            }));
        }

        const { dateRange, startDate, endDate } = this.exportOptions;
        let filteredData = [...this.data]; // Use all data, not filtered data

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (dateRange) {
            case 'today':
                const todayEnd = new Date(today);
                todayEnd.setHours(23, 59, 59, 999);
                filteredData = filteredData.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= today && entryDate <= todayEnd;
                });
                break;
            case 'week':
                const monday = new Date(today);
                monday.setDate(today.getDate() - today.getDay() + 1);
                const saturday = new Date(monday);
                saturday.setDate(monday.getDate() + 5);
                saturday.setHours(23, 59, 59, 999);
                filteredData = filteredData.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= monday && entryDate <= saturday;
                });
                break;
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                monthEnd.setHours(23, 59, 59, 999);
                filteredData = filteredData.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= monthStart && entryDate <= monthEnd;
                });
                break;
            case 'custom':
                const customStart = new Date(startDate);
                const customEnd = new Date(endDate);
                customEnd.setHours(23, 59, 59, 999);
                filteredData = filteredData.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= customStart && entryDate <= customEnd;
                });
                break;
        }

        // Return filtered data without action-related properties
        return filteredData.map(entry => ({
            fullName: entry.fullName,
            grade: entry.grade,
            strand: entry.strand,
            section: entry.section,
            timestamp: entry.timestamp
        }));
    }

    getSummaryDataBySection() {
        try {
            // 📊 Summary by Section (Count of Lates) Export Logic
            // This function aggregates all late records by Grade-Strand-Section combination
            
            // Get the filtered data based on date range
            const rawData = this.getFilteredDataForExport();
            
            if (!rawData || rawData.length === 0) {
                console.log('No data available for summary');
                return [];
            }
            
            // Group by Grade, Strand, Section combination
            // Example: Student A (11-HUMSS-Mabini) + Student B (11-HUMSS-Mabini) = 2 lates for 11-HUMSS-Mabini
            const summary = {};
            
            rawData.forEach(entry => {
                if (!entry.grade || !entry.strand || !entry.section) {
                    console.warn('Entry missing required fields:', entry);
                    return;
                }
                
                const key = `${entry.grade}-${entry.strand}-${entry.section}`;
                
                if (!summary[key]) {
                    summary[key] = {
                        grade: entry.grade,
                        strand: entry.strand,
                        section: entry.section,
                        count: 0
                    };
                }
                
                // Count each late record for this section
                summary[key].count++;
            });
            
            // Convert to array and sort by Grade, then Strand, then Section
            const summaryArray = Object.values(summary);
            
            summaryArray.sort((a, b) => {
                // First sort by Grade
                if (a.grade !== b.grade) {
                    return a.grade.localeCompare(b.grade);
                }
                // Then by Strand
                if (a.strand !== b.strand) {
                    return a.strand.localeCompare(b.strand);
                }
                // Finally by Section
                return a.section.localeCompare(b.section);
            });
            
            console.log('Summary data created:', summaryArray);
            return summaryArray;
        } catch (error) {
            console.error('Error creating summary data:', error);
            return [];
        }
    }

    // Theme Management
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.elements.themeToggle.innerHTML = newTheme === 'dark' ? 
            '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        this.saveUserPreference('theme', newTheme);
    }

    // User Preferences
    saveUserPreference(key, value) {
        const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        preferences[key] = value;
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
    }

    loadUserPreferences() {
        const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        
        // Load theme
        if (preferences.theme) {
            document.documentElement.setAttribute('data-theme', preferences.theme);
            this.elements.themeToggle.innerHTML = preferences.theme === 'dark' ? 
                '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }

        // Load mode
        if (preferences.currentMode) {
            this.switchMode(preferences.currentMode);
        }
    }

    // Offline Support
    setupOfflineDetection() {
        this.isOnline = navigator.onLine;
        this.updateOfflineIndicator();
    }

    handleOnline() {
        this.isOnline = true;
        this.updateOfflineIndicator();
        this.syncPendingData();
    }

    handleOffline() {
        this.isOnline = false;
        this.updateOfflineIndicator();
    }

    updateOfflineIndicator() {
        let indicator = document.querySelector('.offline-indicator');
        
        if (!this.isOnline) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'offline-indicator';
                indicator.textContent = 'You are currently offline. Data will be saved locally.';
                document.body.appendChild(indicator);
            }
        } else {
            if (indicator) {
                indicator.remove();
            }
        }
    }

    async syncPendingData() {
        if (this.pendingSync.length === 0) return;

        try {
            for (const item of this.pendingSync) {
                if (item.collection === 'gradeStrandSections') {
                    if (item.action === 'delete') {
                        const docId = `${item.grade}-${item.strand}-${item.section}`;
                        const docRef = this.firebase.doc(this.db, 'gradeStrandSections', docId);
                        await this.firebase.deleteDoc(docRef);
                    } else {
                        const docId = `${item.grade}-${item.strand}-${item.section}`;
                        const docRef = this.firebase.doc(this.db, 'gradeStrandSections', docId);
                        await this.firebase.setDoc(docRef, {
                            grade: item.grade,
                            strand: item.strand,
                            section: item.section
                        });
                    }
                } else {
                    if (item.action === 'delete') {
                        const docRef = this.firebase.doc(this.db, 'tardiness', item.id);
                        await this.firebase.deleteDoc(docRef);
                    } else if (item.action === 'update') {
                        const { action, ...entry } = item;
                        const docRef = this.firebase.doc(this.db, 'tardiness', entry.id);
                        await this.firebase.updateDoc(docRef, entry);
                    } else {
                        const docRef = this.firebase.doc(this.db, 'tardiness', item.id);
                        await this.firebase.setDoc(docRef, item);
                    }
                }
            }
            
            this.pendingSync = [];
            this.showToast('All pending data synced successfully!', 'success');
        } catch (error) {
            console.error('Error syncing pending data:', error);
            this.showToast('Error syncing pending data. Please try again.', 'error');
        }
    }

    // Enhanced Entry Management Functions
    checkDuplicateEntry(newEntry) {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const todaysEntries = this.data.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= todayStart && entryDate < todayEnd;
        });
        
        const duplicateEntries = todaysEntries.filter(entry => 
            entry.fullName.toLowerCase() === newEntry.fullName.toLowerCase() &&
            entry.grade === newEntry.grade &&
            entry.strand === newEntry.strand &&
            entry.section === newEntry.section
        );
        
        return {
            isDuplicate: duplicateEntries.length > 0,
            count: duplicateEntries.length + 1,
            previousEntry: duplicateEntries[0] || null
        };
    }

    showDuplicateModal(entry, duplicateCheck) {
        console.log('Showing duplicate modal for:', entry, 'duplicateCheck:', duplicateCheck);
        
        const modal = document.createElement('div');
        modal.className = 'modal duplicate-modal';
        
        const previousTime = new Date(duplicateCheck.previousEntry.timestamp).toLocaleTimeString();
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-exclamation-triangle"></i> Duplicate Late Entry Detected</h2>
                </div>
                <div class="modal-body">
                    <div class="duplicate-details">
                        <p><strong>${entry.fullName}</strong> has already been marked late today at <strong>${previousTime}</strong>.</p>
                        <p>This will be their <strong>${duplicateCheck.count}${this.getOrdinalSuffix(duplicateCheck.count)}</strong> late entry for today.</p>
                        <p>Are you sure you want to record this again?</p>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="cancel-btn" onclick="app.closeDuplicateModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="confirm-btn" onclick="app.confirmDuplicateEntry()">
                        <i class="fas fa-check"></i> Confirm Add Again
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        console.log('Duplicate modal added to DOM');
        
        // Show the modal using the CSS class
        setTimeout(() => {
            modal.classList.add('show');
            console.log('Duplicate modal should now be visible');
        }, 50);
        
        // Store entry data for confirmation
        this.pendingDuplicateEntry = { entry, duplicateCheck };
    }

    async confirmDuplicateEntry() {
        console.log('Confirming duplicate entry...');
        
        if (this.pendingDuplicateEntry) {
            const { entry, duplicateCheck } = this.pendingDuplicateEntry;
            
            // Close the modal first to prevent any UI issues
            this.closeDuplicateModal();
            
            // Add the duplicate entry directly without checking for duplicates again
            try {
                console.log('Adding confirmed duplicate entry:', entry);
                
                // Add to local data
                this.data.unshift(entry);
                this.filteredData.unshift(entry);
                
                // Update UI
                this.renderTable();
                this.updateSummary();
                
                // Save to Firebase
                if (this.isOnline && this.db && this.firebase) {
                    console.log('Saving duplicate entry to Firebase...');
                    const docRef = this.firebase.doc(this.db, 'tardiness', entry.id);
                    await this.firebase.setDoc(docRef, entry);
                    console.log('Duplicate entry saved to Firebase successfully');
                }
                
                // Save to localStorage as backup
                this.saveToLocalStorage();
                
                // Show success message for duplicate
                this.showDuplicateSuccess(entry, duplicateCheck.count);
                
                console.log('Duplicate entry added successfully');
                
            } catch (error) {
                console.error('Error adding duplicate entry:', error);
                this.showToast('Error adding duplicate entry. Please try again.', 'error');
            }
            
            // Clear pending entry
            this.pendingDuplicateEntry = null;
            
            // Reset form and focus
            this.resetFormAndFocus();
        }
    }

    closeDuplicateModal() {
        console.log('Closing duplicate modal...');
        
        const modal = document.querySelector('.duplicate-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
            console.log('Duplicate modal closed');
        }
        
        // Clear pending entry
        this.pendingDuplicateEntry = null;
        
        // Reset form when canceling to ensure user can continue
        this.resetFormAndFocus();
    }

    resetFormAndFocus() {
        console.log('=== RESET FORM AND FOCUS START ===');
        console.log('Resetting form and focusing...');
        
        // Get form elements
        const fullNameInput = document.getElementById('fullName');
        const gradeInput = document.getElementById('grade');
        const strandInput = document.getElementById('strand');
        const sectionInput = document.getElementById('section');
        
        console.log('Input elements found:', {
            fullNameInput: !!fullNameInput,
            gradeInput: !!gradeInput,
            strandInput: !!strandInput,
            sectionInput: !!sectionInput
        });
        
        // Reset the form first
        this.elements.manualForm.reset();
        console.log('Form reset called');
        
        // Manually clear all input fields to ensure they're cleared
        if (fullNameInput) {
            console.log('Before clearing fullName:', fullNameInput.value);
            fullNameInput.value = '';
            console.log('After clearing fullName:', fullNameInput.value);
        }
        if (gradeInput) {
            console.log('Before clearing grade:', gradeInput.value);
            gradeInput.selectedIndex = 0; // Reset to first option
            console.log('After clearing grade:', gradeInput.value);
        }
        if (strandInput) {
            console.log('Before clearing strand:', strandInput.value);
            strandInput.selectedIndex = 0; // Reset to first option
            console.log('After clearing strand:', strandInput.value);
        }
        if (sectionInput) {
            console.log('Before clearing section:', sectionInput.value);
            sectionInput.selectedIndex = 0; // Reset to first option
            console.log('After clearing section:', sectionInput.value);
        }
        
        // Force focus on first input field immediately
        setTimeout(() => {
            if (fullNameInput) {
                fullNameInput.focus();
                console.log('Focused on fullName input');
            }
        }, 50);
        
        console.log('=== RESET FORM AND FOCUS END ===');
    }

    showFirstEntrySuccess(entry) {
        console.log('Showing first entry success for:', entry);
        const timeRecorded = new Date(entry.timestamp).toLocaleTimeString();
        
        // Remove any existing success modals first
        const existingModals = document.querySelectorAll('.success-modal');
        existingModals.forEach(modal => {
            console.log('Removing existing modal:', modal);
            modal.remove();
        });
        
        // Small delay to ensure DOM is clean
        setTimeout(() => {
            // Show detailed success modal for first entry
            this.showSuccessModal(entry, timeRecorded, false);
            console.log('Success modal should be displayed');
        }, 50);
    }

    showDuplicateSuccess(entry, count) {
        const timeRecorded = new Date(entry.timestamp).toLocaleTimeString();
        
        // Show detailed success modal for duplicate
        this.showSuccessModal(entry, timeRecorded, true, count);
    }

    showSuccessModal(entry, timeRecorded, isDuplicate = false, count = 1) {
        console.log('=== SHOW SUCCESS MODAL START ===');
        console.log('Creating success modal for:', entry, 'isDuplicate:', isDuplicate, 'count:', count);
        
        // Remove any existing success modals first
        const existingModals = document.querySelectorAll('.success-modal');
        existingModals.forEach(modal => modal.remove());
        
        const modal = document.createElement('div');
        modal.className = 'modal success-modal';
        console.log('Modal element created with classes:', modal.className);
        
        const modalTitle = isDuplicate ? 'Duplicate Entry Recorded' : 'Late Entry Recorded Successfully';
        const modalIcon = isDuplicate ? 'fa-check-double' : 'fa-check-circle';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header success">
                    <h2><i class="fas ${modalIcon}"></i> ${modalTitle}</h2>
                </div>
                <div class="modal-body">
                    <div class="success-details">
                        <p><strong>Student:</strong> ${entry.fullName}</p>
                        <p><strong>Grade-Strand-Section:</strong> ${entry.grade} ${entry.strand} ${entry.section}</p>
                        <p><strong>Time Recorded:</strong> ${timeRecorded}</p>
                        ${isDuplicate ? `<p><strong>Late Count Today:</strong> ${count}${this.getOrdinalSuffix(count)} time</p>` : ''}
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="confirm-btn" onclick="app.closeSuccessModal()">
                        <i class="fas fa-check"></i> OK
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        console.log('Success modal added to DOM');
        console.log('Modal element in DOM:', document.querySelector('.success-modal'));
        
        // Force a reflow to ensure the modal is properly rendered
        modal.offsetHeight;
        
        // Show the modal using the CSS class
        setTimeout(() => {
            console.log('Adding show class to modal...');
            modal.classList.add('show');
            console.log('Modal classes after adding show:', modal.className);
            console.log('Modal should now be visible');
        }, 50);
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            console.log('Auto-closing modal...');
            this.closeSuccessModal();
        }, 3000);
        
        console.log('=== SHOW SUCCESS MODAL END ===');
    }

    closeSuccessModal() {
        console.log('Closing success modal...');
        const modal = document.querySelector('.success-modal');
        if (modal) {
            console.log('Success modal found, removing...');
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
                console.log('Success modal removed from DOM');
            }, 300);
        } else {
            console.log('No success modal found to close');
        }
    }

    showDeleteSuccessModal(entry) {
        console.log('Showing delete success modal for:', entry);
        const timeRecorded = new Date(entry.timestamp).toLocaleTimeString();

        // Remove any existing success modals first
        const existingModals = document.querySelectorAll('.success-modal');
        existingModals.forEach(modal => modal.remove());

        const modal = document.createElement('div');
        modal.className = 'modal success-modal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header success">
                    <h2><i class="fas fa-trash-check"></i> Entry Deleted Successfully</h2>
                </div>
                <div class="modal-body">
                    <div class="success-details">
                        <p><strong>Student:</strong> ${entry.fullName}</p>
                        <p><strong>Grade-Strand-Section:</strong> ${entry.grade} ${entry.strand} ${entry.section}</p>
                        <p><strong>Time Recorded:</strong> ${timeRecorded}</p>
                        <p style="color: #dc3545; font-weight: bold;"><i class="fas fa-trash"></i> This entry has been deleted</p>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="confirm-btn" onclick="app.closeSuccessModal()">
                        <i class="fas fa-check"></i> OK
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('Delete success modal added to DOM');

        // Force a reflow to ensure the modal is properly rendered
        modal.offsetHeight;

        // Show the modal using the CSS class
        setTimeout(() => {
            modal.classList.add('show');
            console.log('Delete success modal should now be visible');
        }, 50);

        // Auto-close after 3 seconds
        setTimeout(() => {
            this.closeSuccessModal();
        }, 3000);
    }

    showOptionAddedSuccessModal(option) {
        console.log('Showing option added success modal for:', option);

        // Remove any existing success modals first
        const existingModals = document.querySelectorAll('.success-modal');
        existingModals.forEach(modal => modal.remove());

        const modal = document.createElement('div');
        modal.className = 'modal success-modal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header success">
                    <h2><i class="fas fa-plus-circle"></i> New Option Added Successfully</h2>
                </div>
                <div class="modal-body">
                    <div class="success-details">
                        <p><strong>Grade:</strong> ${option.grade}</p>
                        <p><strong>Strand:</strong> ${option.strand}</p>
                        <p><strong>Section:</strong> ${option.section}</p>
                        <p style="color: #059669; font-weight: bold;"><i class="fas fa-check"></i> Option added to Quick Select</p>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="confirm-btn" onclick="app.closeSuccessModal()">
                        <i class="fas fa-check"></i> OK
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('Option added success modal added to DOM');

        // Force a reflow to ensure the modal is properly rendered
        modal.offsetHeight;

        // Show the modal using the CSS class
        setTimeout(() => {
            modal.classList.add('show');
            console.log('Option added success modal should now be visible');
        }, 50);

        // Auto-close after 3 seconds
        setTimeout(() => {
            this.closeSuccessModal();
        }, 3000);
    }

    getOrdinalSuffix(num) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) {
            return "st";
        }
        if (j === 2 && k !== 12) {
            return "nd";
        }
        if (j === 3 && k !== 13) {
            return "rd";
        }
        return "th";
    }

    // Utility Functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    capitalizeName(name) {
        if (!name || typeof name !== 'string') return name;
        
        // Split the name into words and capitalize each word's first letter
        return name.trim().toLowerCase().split(' ').map(word => {
            if (word.length > 0) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            return word;
        }).join(' ');
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('tardinessData', JSON.stringify(this.data));
            console.log('Data saved to localStorage:', this.data.length, 'entries');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Test function for debugging modals
    testModals() {
        console.log('Testing modals...');
        
        // Test success modal
        const testEntry = {
            fullName: 'Test Student',
            grade: '10',
            strand: 'STEM',
            section: 'A',
            timestamp: new Date().toISOString(),
            id: 'test123'
        };
        
        this.showSuccessModal(testEntry, new Date().toLocaleTimeString(), false);
        console.log('Success modal test completed');
    }

    // Test form reset
    testFormReset() {
        console.log('Testing form reset...');
        
        // Fill the form with test data first
        const fullNameInput = document.getElementById('fullName');
        const gradeInput = document.getElementById('grade');
        const strandInput = document.getElementById('strand');
        const sectionInput = document.getElementById('section');
        
        if (fullNameInput) fullNameInput.value = 'Test Student';
        if (gradeInput) gradeInput.value = '11';
        if (strandInput) strandInput.value = 'STEM';
        if (sectionInput) sectionInput.value = 'A';
        
        console.log('Form filled with test data');
        
        // Test the reset function
        setTimeout(() => {
            this.resetFormAndFocus();
            console.log('Form reset test completed');
        }, 1000);
    }

    // Test complete flow
    testCompleteFlow() {
        console.log('Testing complete flow...');
        
        // Fill the form with test data
        const fullNameInput = document.getElementById('fullName');
        const gradeInput = document.getElementById('grade');
        const strandInput = document.getElementById('strand');
        const sectionInput = document.getElementById('section');
        
        if (fullNameInput) fullNameInput.value = 'Test Student';
        if (gradeInput) gradeInput.value = '11';
        if (strandInput) strandInput.value = 'STEM';
        if (sectionInput) sectionInput.value = 'A';
        
        console.log('Form filled with test data');
        
        // Simulate form submission
        setTimeout(() => {
            const testEntry = {
                fullName: 'Test Student',
                grade: '11',
                strand: 'STEM',
                section: 'A',
                timestamp: new Date().toISOString(),
                id: this.generateId()
            };
            
            console.log('Simulating successful entry addition...');
            this.addEntry(testEntry).then((result) => {
                console.log('Add entry result:', result);
                if (result) {
                    this.resetFormAndFocus();
                    this.showFirstEntrySuccess(testEntry);
                }
            });
        }, 1000);
    }

    // Debug function to test all modals
    debugModals() {
        console.log('=== DEBUGGING MODALS ===');
        
        // Test 1: Success Modal
        console.log('Testing success modal...');
        const testEntry = {
            fullName: 'Debug Test Student',
            grade: '12',
            strand: 'STEM',
            section: 'A',
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };
        
        this.showFirstEntrySuccess(testEntry);
        
        // Test 2: Delete Success Modal after 4 seconds
        setTimeout(() => {
            console.log('Testing delete success modal...');
            this.showDeleteSuccessModal(testEntry);
        }, 4000);
        
        // Test 3: Option Added Modal after 8 seconds
        setTimeout(() => {
            console.log('Testing option added modal...');
            this.showOptionAddedSuccessModal({ grade: 11, strand: 'TEST', section: 'DEBUG' });
        }, 8000);
        
        // Test 4: Management Modal after 12 seconds
        setTimeout(() => {
            console.log('Testing management modal...');
            this.openManagementModal();
        }, 12000);
    }

    // Quick test for form reset
    testFormReset() {
        console.log('Testing form reset and success modal...');
        
        // Fill form with test data
        document.getElementById('fullName').value = 'Test Form Reset';
        document.getElementById('grade').value = '11';
        document.getElementById('strand').value = 'STEM';
        document.getElementById('section').value = 'A';
        
        console.log('Form filled, now testing reset...');
        
        setTimeout(() => {
            this.resetFormAndFocus();
            
            // Show success modal
            setTimeout(() => {
                const testEntry = {
                    fullName: 'Test Form Reset',
                    grade: '11',
                    strand: 'STEM',
                    section: 'A',
                    timestamp: new Date().toISOString(),
                    id: this.generateId()
                };
                this.showFirstEntrySuccess(testEntry);
            }, 500);
        }, 1000);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing TardinessMonitor...');
    const app = new TardinessMonitor();
    window.app = app;
    console.log('App initialized and attached to window:', window.app);
});

// Add slideOut animation for toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style); 