document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // 1. VARIABLES GLOBALES ET CONFIGURATION
    // =================================================================================
    const API_BASE_URL = '';
    let currentBooks = [];
    let currentLanguage = 'ar';
    let currentPage = 1;
    let totalPages = 1;
    let isLoading = false;
    let barcodeStream = null;
    let currentLoanType = 'students';
    let pendingChanges = {};

    // =================================================================================
    // 2. RÉFÉRENCES AUX ÉLÉMENTS DU DOM ET TRADUCTIONS
    // =================================================================================
    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const loginForm = document.getElementById('login-form');
    const loanForm = document.getElementById('loan-form');
    const manualBookForm = document.getElementById('manual-book-form');
    const searchInput = document.getElementById('search-input');
    const saveChangesBtn = document.getElementById('save-all-changes-btn');
    const translations = {
        ar: { welcome_title: 'مرحباً بكم في مكتبة مدارس الكوثر العالمية', welcome_subtitle: 'الرجاء إدخال بيانات الاعتماد الخاصة بك للوصول إلى لوحة التحكم.', username_placeholder: 'اسم المستخدم', password_placeholder: 'كلمة المرور', login_button: 'تسجيل الدخول', dashboard_title: 'لوحة تحكم مكتبة الكوثر', school_name: 'مدارس الكوثر العالمية', logout: 'تسجيل الخروج', loading_data: 'تحميل البيانات...', overdue_books_title: 'كتب متأخرة في الإرجاع', dismiss: 'إخفاء التنبيه', library_stats: 'إحصائيات المكتبة', total_books: 'إجمالي الكتب', loaned_books: 'الكتب المعارة', available_books: 'الكتب المتاحة', copies_loaned: 'عدد النسخ المعارة', view_student_borrowers: 'عرض الطلاب المستعيرين', view_teacher_borrowers: 'عرض المدرسين المستعيرين', export_excel_data: 'تحميل بيانات Excel', loan_management: 'إدارة الإعارة', loan_isbn_label: 'ISBN الكتاب', scan_barcode_title: 'مسح الباركود', book_title_label: 'عنوان الكتاب', borrower_type_label: 'نوع المستعير', student_option: 'طالب', teacher_option: 'مدرس/ة', borrower_name_label: 'اسم المستعير', class_subject_label: 'الفصل/المادة', loan_copies_label: 'عدد النسخ المستعارة', available_copies_info: 'عدد النسخ المتاحة:', loan_date_label: 'تاريخ الإعارة', return_date_label: 'تاريخ التسليم', loan_book_button: 'إعارة الكتاب', add_book_manually: 'إضافة كتاب يدوياً', manual_isbn_label: 'ISBN', manual_title_label: 'عنوان الكتاب', manual_copies_label: 'عدد النسخ', manual_subject_label: 'المادة', manual_level_label: 'المستوى', manual_language_label: 'اللغة', manual_corner_name_label: 'اسم الركن', manual_corner_number_label: 'رقم الركن', add_book_button: 'إضافة الكتاب', upload_excel: 'رفع ملف Excel للكتب', choose_excel_file_label: 'اختر ملف Excel', upload_file_button: 'رفع الملف', inventory_search: 'البحث في المخزون وإدارة الكتب', search_placeholder: 'ابحث بالعنوان أو ISBN أو المادة...', refresh: 'تحديث', save_all_changes: 'حفظ جميع التغييرات', previous_page: 'السابق', next_page: 'التالي', page_info: 'صفحة {currentPage} من {totalPages}', copyright: '© 2025 مدارس الكوثر العالمية - جميع الحقوق محفوظة.', student_borrowers_list: 'قائمة الطلاب المستعيرين', teacher_borrowers_list: 'قائمة المدرسين المستعيرين', search_in_loans: 'ابحث بالاسم، العنوان، أو ISBN...', extend_return_date: 'تمديد فترة الارجاع', current_return_date: 'تاريخ الإرجاع الحالي', new_return_date: 'تاريخ الإرجاع الجديد', extend_loan: 'تمديد الإعارة', scan_barcode_modal_title: 'مسح الباركود', start_scan_button: 'بدء المسح', stop_scan_button: 'إيقاف المسح', code_detected_text: 'تم اكتشاف الرمز:', use_this_code_button: 'استخدام هذا الرمز', camera_help_text: 'وجه الكاميرا نحو الباركود للمسح التلقائي', isbn: 'ISBN', title: 'العنوان', total_copies: 'إجمالي النسخ', loaned_copies: 'النسخ المعارة', available_copies: 'النسخ المتاحة', subject: 'المادة', level: 'المستوى', language: 'اللغة', corner_name: 'اسم الركن', corner_number: 'رقم الركن', actions: 'الإجراءات', edit: 'تعديل', delete: 'حذف', cancel: 'إلغاء', return_book: 'إرجاع', extend: 'تمديد', book_not_found: 'كتاب غير موجود', no_results: 'لا توجد نتائج.', select_a_valid_book: 'الرجاء تحديد كتاب صالح أولاً.', confirm_delete_title: 'تأكيد الحذف', confirm_delete_text: 'هل أنت متأكد من حذف الكتاب "{title}"؟ لا يمكن التراجع عن هذا الإجراء.', not_enough_copies: 'لا توجد نسخ كافية متاحة. المتاح: {available}', loan_date_col: 'تاريخ الإعارة', return_date_col: 'تاريخ الإرجاع', overdue_days: 'أيام التأخير', copies_count: 'عدد النسخ', student_name: 'اسم الطالب', teacher_name: 'اسم المدرس', class_section: 'الصف/الشعبة', },
        fr: { welcome_title: 'Bienvenue à la bibliothèque des Écoles Internationales Al-Kawthar', welcome_subtitle: 'Veuillez saisir vos identifiants pour accéder au tableau de bord.', username_placeholder: 'Nom d\'utilisateur', password_placeholder: 'Mot de passe', login_button: 'Se connecter', dashboard_title: 'Tableau de bord de la bibliothèque Al-Kawthar', school_name: 'Écoles Internationales Al-Kawthar', logout: 'Se déconnecter', loading_data: 'Chargement des données...', overdue_books_title: 'Livres en retard', dismiss: 'Masquer l\'alerte', library_stats: 'Statistiques de la bibliothèque', total_books: 'Total des livres', loaned_books: 'Livres prêtés', available_books: 'Livres disponibles', copies_loaned: 'Copies prêtées', view_student_borrowers: 'Voir les étudiants emprunteurs', view_teacher_borrowers: 'Voir les enseignants emprunteurs', export_excel_data: 'Exporter les données Excel', loan_management: 'Gestion des prêts', loan_isbn_label: 'ISBN du livre', scan_barcode_title: 'Scanner le code-barres', book_title_label: 'Titre du livre', borrower_type_label: 'Type d\'emprunteur', student_option: 'Étudiant', teacher_option: 'Enseignant', borrower_name_label: 'Nom de l\'emprunteur', class_subject_label: 'Classe/Matière', loan_copies_label: 'Nombre de copies prêtées', available_copies_info: 'Copies disponibles :', loan_date_label: 'Date du prêt', return_date_label: 'Date de retour', loan_book_button: 'Prêter le livre', add_book_manually: 'Ajouter un livre manuellement', manual_isbn_label: 'ISBN', manual_title_label: 'Titre du livre', manual_copies_label: 'Nombre de copies', manual_subject_label: 'Matière', manual_level_label: 'Niveau', manual_language_label: 'Langue', manual_corner_name_label: 'Nom du coin', manual_corner_number_label: 'Numéro du coin', add_book_button: 'Ajouter le livre', upload_excel: 'Importer un fichier Excel', choose_excel_file_label: 'Choisir un fichier Excel', upload_file_button: 'Importer le fichier', inventory_search: 'Recherche et gestion de l\'inventaire', search_placeholder: 'Rechercher par titre, ISBN, matière...', refresh: 'Actualiser', save_all_changes: 'Sauvegarder les changements', previous_page: 'Précédent', next_page: 'Suivant', page_info: 'Page {currentPage} sur {totalPages}', copyright: '© 2025 Écoles Internationales Al-Kawthar - Tous droits réservés.', student_borrowers_list: 'Liste des étudiants emprunteurs', teacher_borrowers_list: 'Liste des enseignants emprunteurs', search_in_loans: 'Rechercher par nom, titre ou ISBN...', extend_return_date: 'Prolonger la date de retour', current_return_date: 'Date de retour actuelle', new_return_date: 'Nouvelle date de retour', extend_loan: 'Prolonger le prêt', scan_barcode_modal_title: 'Scanner le code-barres', start_scan_button: 'Démarrer le scan', stop_scan_button: 'Arrêter le scan', code_detected_text: 'Code détecté :', use_this_code_button: 'Utiliser ce code', camera_help_text: 'Dirigez la caméra vers le code-barres pour un scan automatique', isbn: 'ISBN', title: 'Titre', total_copies: 'Copies Totales', loaned_copies: 'Copies Prêtées', available_copies: 'Copies Disponibles', subject: 'Matière', level: 'Niveau', language: 'Langue', corner_name: 'Nom du Coin', corner_number: 'N° du Coin', actions: 'Actions', edit: 'Modifier', delete: 'Supprimer', cancel: 'Annuler', return_book: 'Retourner', extend: 'Prolonger', book_not_found: 'Livre introuvable', no_results: 'Aucun résultat.', select_a_valid_book: 'Veuillez d\'abord sélectionner un livre valide.', confirm_delete_title: 'Confirmer la suppression', confirm_delete_text: 'Êtes-vous sûr de vouloir supprimer le livre "{title}" ? Cette action est irréversible.', not_enough_copies: 'Pas assez de copies disponibles. Disponibles : {available}', loan_date_col: 'Date de prêt', return_date_col: 'Date de retour', overdue_days: 'Jours de retard', copies_count: 'Nombre de copies', student_name: 'Nom de l\'étudiant', teacher_name: 'Nom de l\'enseignant', class_section: 'Classe/Section', },
        en: { welcome_title: 'Welcome to Al-Kawthar International Schools Library', welcome_subtitle: 'Please enter your credentials to access the dashboard.', username_placeholder: 'Username', password_placeholder: 'Password', login_button: 'Login', dashboard_title: 'Al-Kawthar Library Dashboard', school_name: 'Al-Kawthar International Schools', logout: 'Logout', loading_data: 'Loading data...', overdue_books_title: 'Overdue Books', dismiss: 'Dismiss Alert', library_stats: 'Library Statistics', total_books: 'Total Books', loaned_books: 'Loaned Books', available_books: 'Available Books', copies_loaned: 'Copies Loaned', view_student_borrowers: 'View Student Borrowers', view_teacher_borrowers: 'View Teacher Borrowers', export_excel_data: 'Export Excel Data', loan_management: 'Loan Management', loan_isbn_label: 'Book ISBN', scan_barcode_title: 'Scan Barcode', book_title_label: 'Book Title', borrower_type_label: 'Borrower Type', student_option: 'Student', teacher_option: 'Teacher', borrower_name_label: 'Borrower Name', class_subject_label: 'Class/Subject', loan_copies_label: 'Number of Copies Loaned', available_copies_info: 'Available copies:', loan_date_label: 'Loan Date', return_date_label: 'Return Date', loan_book_button: 'Loan Book', add_book_manually: 'Add Book Manually', manual_isbn_label: 'ISBN', manual_title_label: 'Book Title', manual_copies_label: 'Number of Copies', manual_subject_label: 'Subject', manual_level_label: 'Level', manual_language_label: 'Language', manual_corner_name_label: 'Corner Name', manual_corner_number_label: 'Corner Number', add_book_button: 'Add Book', upload_excel: 'Upload Excel File', choose_excel_file_label: 'Choose Excel File', upload_file_button: 'Upload File', inventory_search: 'Inventory Search & Management', search_placeholder: 'Search by title, ISBN, or subject...', refresh: 'Refresh', save_all_changes: 'Save All Changes', previous_page: 'Previous', next_page: 'Next', page_info: 'Page {currentPage} of {totalPages}', copyright: '© 2025 Al-Kawthar International Schools - All rights reserved.', student_borrowers_list: 'Student Borrowers List', teacher_borrowers_list: 'Teacher Borrowers List', search_in_loans: 'Search by name, title, or ISBN...', extend_return_date: 'Extend Return Date', current_return_date: 'Current Return Date', new_return_date: 'New Return Date', extend_loan: 'Extend Loan', scan_barcode_modal_title: 'Scan Barcode', start_scan_button: 'Start Scan', stop_scan_button: 'Stop Scan', code_detected_text: 'Code Detected:', use_this_code_button: 'Use This Code', camera_help_text: 'Point the camera at the barcode for automatic scanning', isbn: 'ISBN', title: 'Title', total_copies: 'Total Copies', loaned_copies: 'Loaned Copies', available_copies: 'Available Copies', subject: 'Subject', level: 'Level', language: 'Language', corner_name: 'Corner Name', corner_number: 'Corner No.', actions: 'Actions', edit: 'Edit', delete: 'Delete', cancel: 'Cancel', return_book: 'Return', extend: 'Extend', book_not_found: 'Book not found', no_results: 'No results found.', select_a_valid_book: 'Please select a valid book first.', confirm_delete_title: 'Confirm Deletion', confirm_delete_text: 'Are you sure you want to delete the book "{title}"? This action cannot be undone.', not_enough_copies: 'Not enough copies available. Available: {available}', loan_date_col: 'Loan Date', return_date_col: 'Return Date', overdue_days: 'Overdue Days', copies_count: 'Copies Count', student_name: 'Student Name', teacher_name: 'Teacher Name', class_section: 'Class/Section', }
    };

    // =================================================================================
    // 3. DÉFINITION DE TOUTES LES FONCTIONS
    // =================================================================================
    
    function getTranslatedText(key, replacements = {}) {
        let text = translations[currentLanguage]?.[key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    }
    
    function showLoadingBar(text = '') {
        const loadingBar = document.getElementById('loading-bar');
        if (loadingBar) {
            const loadingDetails = document.getElementById('loading-details');
            loadingBar.style.display = 'block';
            if (text) loadingDetails.innerHTML = `<small>${text}</small>`;
        }
    }
    
    function updateLoadingProgress(percentage, text = '') {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = percentage + '%';
            document.getElementById('loading-percentage').textContent = Math.round(percentage) + '%';
            if (text) document.getElementById('loading-details').innerHTML = `<small>${text}</small>`;
        }
    }

    function hideLoadingBar() {
        setTimeout(() => {
            const loadingBar = document.getElementById('loading-bar');
            if (loadingBar) {
                loadingBar.style.display = 'none';
                document.getElementById('progress-fill').style.width = '0%';
            }
        }, 500);
    }

    function formatDateByLanguage(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'fr' ? 'fr-FR' : 'en-US';
        return date.toLocaleDateString(locale, options);
    }
    
    function addTableActionListeners() {
        document.querySelectorAll('.edit-book-btn').forEach(btn => btn.addEventListener('click', handleEditClick));
        document.querySelectorAll('.delete-book-btn').forEach(btn => btn.addEventListener('click', handleDeleteClick));
        document.querySelectorAll('.cancel-edit-btn').forEach(btn => btn.addEventListener('click', handleCancelClick));
    }

    function renderTableHeader() {
        const tableHead = document.querySelector('#books-table thead');
        if (!tableHead) return;

        const verticalHeaders = ['total_copies', 'loaned_copies', 'available_copies'];
        const headers = [
            { key: 'isbn', className: 'col-isbn' },
            { key: 'title', className: 'col-title' },
            { key: 'total_copies', className: 'col-total' },
            { key: 'loaned_copies', className: 'col-loaned' },
            { key: 'available_copies', className: 'col-available' },
            { key: 'subject', className: 'col-subject' },
            { key: 'level', className: 'col-level' },
            { key: 'language', className: 'col-lang' },
            { key: 'corner_name', className: 'col-corner-name' },
            { key: 'corner_number', className: 'col-corner-num' },
            { key: 'actions', className: 'col-actions' }
        ];

        tableHead.innerHTML = `<tr>${headers.map(h => {
            const isVertical = verticalHeaders.includes(h.key);
            const classList = `${h.className} ${isVertical ? 'vertical-text' : ''}`;
            return `<th class="${classList}">${getTranslatedText(h.key)}</th>`;
        }).join('')}</tr>`;
    }
    
    function renderTable(books) {
        renderTableHeader();
        const tableBody = document.getElementById('books-table-body');
        if (!tableBody) return;

        if (!books || books.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 2rem;">${getTranslatedText('no_results')}</td></tr>`;
            return;
        }
        tableBody.innerHTML = books.map(book => {
            const isEditing = pendingChanges[book._id] && pendingChanges[book._id]._isEditing;
            const available = (book.totalCopies || 0) - (book.loanedCopies || 0);
            const data = { ...book, availableCopies: available, ...(pendingChanges[book._id] || {}) };
            return `
                <tr data-id="${book._id}" class="${isEditing ? 'row-editing' : ''}">
                    <td class="col-isbn" data-field="isbn">${data.isbn}</td>
                    <td class="col-title" data-field="title">${data.title}</td>
                    <td class="col-total" data-field="totalCopies">${data.totalCopies}</td>
                    <td class="col-loaned">${data.loanedCopies}</td>
                    <td class="availability-cell ${data.availableCopies > 0 ? 'status-available' : 'status-unavailable'}">${data.availableCopies}</td>
                    <td class="col-subject" data-field="subject">${data.subject || ''}</td>
                    <td class="col-level" data-field="level">${data.level || ''}</td>
                    <td class="col-lang" data-field="language">${data.language || ''}</td>
                    <td class="col-corner-name" data-field="cornerName">${data.cornerName || ''}</td>
                    <td class="col-corner-num" data-field="cornerNumber">${data.cornerNumber || ''}</td>
                    <td class="col-actions action-buttons">
                        ${isEditing ? `<button class="btn-small btn-secondary cancel-edit-btn" title="${getTranslatedText('cancel')}"><i class="fas fa-times"></i></button>` : `<button class="btn-small btn-primary edit-book-btn" title="${getTranslatedText('edit')}"><i class="fas fa-edit"></i></button><button class="btn-small btn-danger delete-book-btn" title="${getTranslatedText('delete')}"><i class="fas fa-trash"></i></button>`}
                    </td>
                </tr>`;
        }).join('');
        addTableActionListeners();
    }
    
    function updatePaginationControls() {
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            const prevBtn = document.getElementById('prev-page-btn');
            const nextBtn = document.getElementById('next-page-btn');
            const controls = document.getElementById('pagination-controls');
            if (totalPages > 1) {
                controls.style.display = 'flex';
                pageInfo.textContent = getTranslatedText('page_info', { currentPage, totalPages });
                prevBtn.disabled = currentPage <= 1;
                nextBtn.disabled = currentPage >= totalPages;
            } else {
                controls.style.display = 'none';
            }
        }
    }

    function updateTranslations() {
        document.querySelectorAll('[data-key]').forEach(el => { el.textContent = getTranslatedText(el.dataset.key); });
        document.querySelectorAll('[data-key-placeholder]').forEach(el => { el.placeholder = getTranslatedText(el.dataset.keyPlaceholder); });
        document.querySelectorAll('[data-key-title]').forEach(el => { el.title = getTranslatedText(el.dataset.keyTitle); });
        
        const studentOption = document.querySelector('#borrower-type option[value="student"]');
        if (studentOption) studentOption.textContent = getTranslatedText('student_option');
        
        const teacherOption = document.querySelector('#borrower-type option[value="teacher"]');
        if (teacherOption) teacherOption.textContent = getTranslatedText('teacher_option');

        updatePaginationControls();
        if (dashboardPage && dashboardPage.style.display !== 'none') {
            renderTable(currentBooks);
        }
    }

    function changeLanguage(lang) {
        currentLanguage = lang;
        localStorage.setItem('preferred_language', lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
        updateTranslations();
    }
    
    async function loadDataForPage(page = 1) {
        if (isLoading) return;
        isLoading = true;
        showLoadingBar(getTranslatedText('loading_data'));
        try {
            updateLoadingProgress(30, getTranslatedText('loading_data'));
            const search = searchInput.value || '';
            const response = await fetch(`${API_BASE_URL}/api/books?page=${page}&limit=50&search=${encodeURIComponent(search)}`);
            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
            const data = await response.json();
            currentBooks = data.books || [];
            currentPage = data.currentPage;
            totalPages = data.totalPages;
            updateLoadingProgress(70, 'Affichage des données...');
            renderTable(currentBooks);
            updatePaginationControls();
            updateLoadingProgress(90, 'Mise à jour des statistiques...');
            await updateStatsFromAPI();
            const loansResponse = await fetch('/api/loans');
            if (loansResponse.ok) checkOverdueBooks(await loansResponse.json());
            updateLoadingProgress(100, 'Chargement terminé !');
        } catch (error) {
            console.error('❌ Erreur de chargement:', error);
            alert("Erreur de chargement des données. Veuillez rafraîchir la page.");
        } finally {
            isLoading = false;
            hideLoadingBar();
        }
    }

    async function updateStatsFromAPI() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/statistics`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            const stats = await response.json();
            document.getElementById('total-books-stat').textContent = stats.totalCopies || 0;
            document.getElementById('loaned-books-stat').textContent = stats.loanedCopies || 0;
            document.getElementById('available-books-stat').textContent = stats.availableCopies || 0;
            document.getElementById('copies-loaned-stat').textContent = stats.activeLoans || 0;
        } catch (error) {
            console.error("Erreur mise à jour stats:", error);
        }
    }
    
    function checkOverdueBooks(allLoans) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueLoans = allLoans.filter(loan => new Date(loan.returnDate) < today);
        const overdueContainer = document.getElementById('overdue-notifications');
        if (overdueContainer) {
            if (overdueLoans.length > 0) {
                const overdueList = document.getElementById('overdue-list');
                overdueList.innerHTML = overdueLoans.map(loan => {
                    const daysOverdue = Math.floor((today - new Date(loan.returnDate)) / (1000 * 60 * 60 * 24));
                    return `<p>• ${loan.title || getTranslatedText('book_not_found')} (${loan.studentName}) - ${getTranslatedText('overdue_days')}: ${daysOverdue}</p>`;
                }).join('');
                overdueContainer.style.display = 'block';
            } else {
                overdueContainer.style.display = 'none';
            }
        }
    }
    
    function handleEditClick(e) { const row = e.target.closest('tr'); makeRowEditable(row); }
    function makeRowEditable(row) {
        const bookId = row.dataset.id;
        if (!pendingChanges[bookId]) pendingChanges[bookId] = {};
        pendingChanges[bookId]._isEditing = true;
        row.classList.add('row-editing');
        row.querySelectorAll('td[data-field]').forEach(cell => {
            const field = cell.dataset.field;
            const originalValue = cell.textContent;
            const inputType = (field === 'totalCopies' || field === 'cornerNumber') ? 'number' : 'text';
            cell.innerHTML = `<input type="${inputType}" class="inline-edit-input" data-field="${field}" value="${originalValue.trim()}">`;
        });
        const actionsCell = row.querySelector('.col-actions');
        actionsCell.innerHTML = `<button class="btn-small btn-secondary cancel-edit-btn" title="${getTranslatedText('cancel')}"><i class="fas fa-times"></i></button>`;
        actionsCell.querySelector('.cancel-edit-btn').addEventListener('click', handleCancelClick);
        row.querySelectorAll('.inline-edit-input').forEach(input => {
            input.addEventListener('input', (e) => {
                pendingChanges[bookId][e.target.dataset.field] = e.target.value;
                saveChangesBtn.style.display = 'inline-block';
            });
        });
    }

    function handleCancelClick(e) {
        const row = e.target.closest('tr');
        delete pendingChanges[row.dataset.id];
        if (Object.keys(pendingChanges).filter(k => k !== '_isEditing').length === 0) {
            saveChangesBtn.style.display = 'none';
        }
        renderTable(currentBooks);
    }
    
    async function handleDeleteClick(e) {
        const row = e.target.closest('tr');
        const bookId = row.dataset.id;
        const bookTitle = row.querySelector('.col-title').textContent;
        if (confirm(getTranslatedText('confirm_delete_text', { title: bookTitle }))) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error((await response.json()).message);
                alert('تم حذف الكتاب بنجاح!');
                await loadDataForPage(currentPage);
            } catch (error) {
                alert(`خطأ في الحذف: ${error.message}`);
            }
        }
    }
    
    async function showDashboard() {
        loginPage.style.display = 'none';
        dashboardPage.style.display = 'block';
        const savedLang = localStorage.getItem('preferred_language') || 'ar';
        initializeAllEventListeners();
        changeLanguage(savedLang);
        initializeDates();
        await loadDataForPage(currentPage);
    }
    
    function initializeDates() {
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('loan-date').value = todayStr;
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
        document.getElementById('return-date').value = twoWeeksLater.toISOString().split('T')[0];
    }
    
    async function displayLoans(type) {
        currentLoanType = type;
        const modalOverlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('loans-modal-title');
        const wrapper = document.getElementById('loans-modal-content-wrapper');
        const endpoint = type === 'students' ? '/api/loans/students' : '/api/loans/teachers';
        modalTitle.textContent = getTranslatedText(type === 'students' ? 'student_borrowers_list' : 'teacher_borrowers_list');
        wrapper.innerHTML = `<p>${getTranslatedText('loading_data')}</p>`;
        modalOverlay.style.display = 'flex';
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
            const loans = await response.json();
            if (!loans || loans.length === 0) {
                wrapper.innerHTML = `<p style="text-align: center;">${getTranslatedText('no_results')}</p>`;
                return;
            }
            wrapper.innerHTML = `<table id="loans-table" style="width: 100%;"><thead><tr><th>${getTranslatedText(type === 'students' ? 'student_name' : 'teacher_name')}</th><th>${getTranslatedText('book_title_label')}</th><th>${getTranslatedText('isbn')}</th><th>${getTranslatedText('copies_count')}</th><th>${getTranslatedText('loan_date_col')}</th><th>${getTranslatedText('return_date_col')}</th><th>${getTranslatedText('overdue_days')}</th><th>${getTranslatedText('actions')}</th></tr></thead><tbody>
                        ${loans.map(loan => {
                const returnDate = new Date(loan.returnDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysOverdue = Math.floor((today - returnDate) / (1000 * 60 * 60 * 24));
                const overdueText = daysOverdue > 0 ? `${daysOverdue}` : 'OK';
                return `<tr data-loan-info='${JSON.stringify(loan).replace(/'/g, "&apos;")}'><td>${loan.studentName}</td><td>${loan.title || 'N/A'}</td><td>${loan.isbn}</td><td>${loan.copiesCount || 1}</td><td>${formatDateByLanguage(loan.loanDate)}</td><td>${formatDateByLanguage(loan.returnDate)}</td><td class="${daysOverdue > 0 ? 'status-unavailable' : 'status-available'}">${overdueText}</td><td class="action-buttons"><button class="btn-small btn-return" title="${getTranslatedText('return_book')}"><i class="fas fa-undo"></i></button><button class="btn-small btn-extend" title="${getTranslatedText('extend')}"><i class="fas fa-calendar-plus"></i></button></td></tr>`;
            }).join('')}
                    </tbody></table>`;
            wrapper.querySelectorAll('.btn-return').forEach(btn => btn.addEventListener('click', async (e) => {
                const loan = JSON.parse(e.target.closest('tr').dataset.loanInfo.replace(/&apos;/g, "'"));
                if (confirm(`Confirmer le retour de "${loan.title}" par ${loan.studentName}?`)) {
                    await returnLoan(loan.isbn, loan.studentName);
                }
            }));
            wrapper.querySelectorAll('.btn-extend').forEach(btn => btn.addEventListener('click', (e) => {
                const loan = JSON.parse(e.target.closest('tr').dataset.loanInfo);
                showExtendDateModal(loan);
            }));
        } catch (error) {
            wrapper.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    async function returnLoan(isbn, studentName) {
        try {
            const response = await fetch('/api/loans', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isbn, studentName }) });
            if (!response.ok) throw new Error('Erreur lors du retour');
            await loadDataForPage(currentPage);
            displayLoans(currentLoanType);
            alert('تم إرجاع الكتاب بنجاح!');
        } catch (error) {
            alert('خطأ في إرجاع الكتاب: ' + error.message);
        }
    }

    function showExtendDateModal(loan) {
        const extendModal = document.getElementById('extend-date-modal-overlay');
        document.getElementById('extend-borrower-name').textContent = loan.studentName;
        document.getElementById('extend-book-title').textContent = loan.title || 'N/A';
        document.getElementById('extend-current-date').textContent = formatDateByLanguage(loan.returnDate);
        const newDateInput = document.getElementById('extend-new-date');
        const oneWeekLater = new Date(loan.returnDate);
        oneWeekLater.setDate(oneWeekLater.getDate() + 7);
        newDateInput.value = oneWeekLater.toISOString().split('T')[0];
        extendModal.dataset.isbn = loan.isbn;
        extendModal.dataset.student = loan.studentName;
        extendModal.style.display = 'flex';
    }

    function initializeBarcodeScanner() {
        const barcodeModal = document.getElementById('barcode-modal-overlay');
        const video = document.getElementById('barcode-video');
        const startBtn = document.getElementById('start-camera-btn');
        const stopBtn = document.getElementById('stop-camera-btn');
        const useBtn = document.getElementById('use-barcode-btn');
        let currentTargetInput = null;
        let animationFrameId = null;
        const openScanner = (targetInputId) => {
            currentTargetInput = document.getElementById(targetInputId);
            barcodeModal.style.display = 'flex';
            document.getElementById('barcode-result').style.display = 'none';
        };
        const stopScanning = () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (barcodeStream) {
                barcodeStream.getTracks().forEach(track => track.stop());
                barcodeStream = null;
            }
            video.srcObject = null;
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
        };
        function scanFrame() {
            if (!barcodeStream || video.readyState !== video.HAVE_ENOUGH_DATA) {
                animationFrameId = requestAnimationFrame(scanFrame);
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                document.getElementById('barcode-value').textContent = code.data;
                document.getElementById('barcode-result').style.display = 'block';
                stopScanning();
            } else {
                animationFrameId = requestAnimationFrame(scanFrame);
            }
        }
        document.getElementById('scan-barcode-btn').addEventListener('click', () => openScanner('loan-isbn'));
        document.getElementById('scan-search-barcode-btn').addEventListener('click', () => openScanner('search-input'));
        startBtn.addEventListener('click', async () => {
            try {
                barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                video.srcObject = barcodeStream;
                await video.play();
                startBtn.style.display = 'none';
                stopBtn.style.display = 'block';
                scanFrame();
            } catch (err) {
                alert("Erreur de caméra: " + err.message);
            }
        });
        stopBtn.addEventListener('click', stopScanning);
        useBtn.addEventListener('click', () => {
            const code = document.getElementById('barcode-value').textContent;
            if (currentTargetInput && code) {
                currentTargetInput.value = code;
                currentTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
                if (currentTargetInput.id === 'search-input') {
                    currentTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            barcodeModal.style.display = 'none';
        });
        document.getElementById('close-barcode-modal').addEventListener('click', () => {
            barcodeModal.style.display = 'none';
            stopScanning();
        });
    }

    function initializeAllEventListeners() {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (document.getElementById('username').value === 'Alkawthar@30' && document.getElementById('password').value === 'Alkawthar@30') {
                localStorage.setItem('isLoggedIn', 'true');
                showDashboard();
            } else {
                document.getElementById('login-error').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
            }
        });

        loanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bookId = loanForm.dataset.bookId;
            if (!bookId) return alert(getTranslatedText('select_a_valid_book'));
            const loanData = {
                bookId,
                studentName: document.getElementById('student-name').value,
                studentClass: document.getElementById('student-class').value,
                borrowerType: document.getElementById('borrower-type').value,
                loanDate: document.getElementById('loan-date').value,
                returnDate: document.getElementById('return-date').value,
                copiesCount: parseInt(document.getElementById('loan-copies').value) || 1
            };
            try {
                const response = await fetch('/api/loans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loanData) });
                if (!response.ok) throw new Error((await response.json()).message);
                loanForm.reset();
                initializeDates();
                document.getElementById('loan-book-title').textContent = '-';
                document.getElementById('available-copies-display').textContent = '-';
                await loadDataForPage(currentPage);
                alert('تم إعارة الكتاب بنجاح!');
            } catch (error) {
                alert('خطأ في إعارة الكتاب: ' + error.message);
            }
        });

        manualBookForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bookData = { isbn: document.getElementById('manual-isbn').value, title: document.getElementById('manual-title').value, totalCopies: parseInt(document.getElementById('manual-copies').value), subject: document.getElementById('manual-subject').value, level: document.getElementById('manual-level').value, language: document.getElementById('manual-language').value, cornerName: document.getElementById('manual-corner-name').value, cornerNumber: document.getElementById('manual-corner-number').value };
            try {
                const response = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookData) });
                if (!response.ok) throw new Error((await response.json()).message);
                manualBookForm.reset();
                await loadDataForPage(1);
                alert('تم إضافة الكتاب بنجاح!');
            } catch (error) {
                alert(`خطأ في الإضافة: ${error.message}`);
            }
        });

        document.getElementById('logout-btn').addEventListener('click', () => { localStorage.removeItem('isLoggedIn'); pendingChanges = {}; window.location.reload(); });
        
        saveChangesBtn.addEventListener('click', async () => {
            const changesToSave = Object.entries(pendingChanges).filter(([, val]) => val._isEditing);
            const promises = changesToSave.map(([bookId, changes]) => {
                const updateData = { ...changes };
                delete updateData._isEditing;
                return fetch(`${API_BASE_URL}/api/books/${bookId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) });
            });
            try {
                const results = await Promise.all(promises);
                const failed = results.filter(res => !res.ok);
                if (failed.length > 0) throw new Error(`${failed.length} mise(s) à jour ont échoué.`);
                alert('تم حفظ جميع التغييرات بنجاح!');
                pendingChanges = {};
                saveChangesBtn.style.display = 'none';
                await loadDataForPage(currentPage);
            } catch (error) {
                alert(`خطأ في الحفظ: ${error.message}`);
            }
        });

        searchInput.addEventListener('input', () => { clearTimeout(searchInput.timer); searchInput.timer = setTimeout(() => loadDataForPage(1), 300); });
        document.getElementById('refresh-books-btn').addEventListener('click', () => loadDataForPage(currentPage));
        document.getElementById('prev-page-btn').addEventListener('click', () => { if (currentPage > 1) loadDataForPage(currentPage - 1); });
        document.getElementById('next-page-btn').addEventListener('click', () => { if (currentPage < totalPages) loadDataForPage(currentPage + 1); });
        
        document.getElementById('upload-excel-btn').addEventListener('click', async () => {
            const fileInput = document.getElementById('excel-file');
            const statusDiv = document.getElementById('upload-status');
            if (!fileInput.files[0]) return alert('يرجى اختيار ملف Excel أولاً');
            const formData = new FormData();
            formData.append('excelFile', fileInput.files[0]);
            statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الملف...';
            try {
                const response = await fetch('/api/books/upload', { method: 'POST', body: formData });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                statusDiv.innerHTML = `<i class="fas fa-check-circle" style="color: green;"></i> تم رفع الملف! تمت إضافة ${result.addedCount} كتاب`;
                fileInput.value = '';
                await loadDataForPage(1);
            } catch (error) {
                statusDiv.innerHTML = `<i class="fas fa-exclamation-circle" style="color: red;"></i> خطأ: ${error.message}`;
            }
        });
        
        document.getElementById('export-excel-btn').addEventListener('click', async () => {
            try {
                const response = await fetch('/api/export/excel');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `library_data_${new Date().toISOString().split('T')[0]}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
            } catch (error) {
                alert('خطأ في تحميل ملف Excel');
            }
        });
        
        document.getElementById('dismiss-alert').addEventListener('click', () => { document.getElementById('overdue-notifications').style.display = 'none'; });
        document.getElementById('view-student-loans-btn').addEventListener('click', () => displayLoans('students'));
        document.getElementById('view-teacher-loans-btn').addEventListener('click', () => displayLoans('teachers'));
        document.querySelector('#modal-overlay .close-modal-btn').addEventListener('click', () => { document.getElementById('modal-overlay').style.display = 'none'; });
        document.getElementById('close-extend-modal').addEventListener('click', () => { document.getElementById('extend-date-modal-overlay').style.display = 'none'; });
        
        document.getElementById('extend-date-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const extendModal = document.getElementById('extend-date-modal-overlay');
            const { isbn, student } = extendModal.dataset;
            const newReturnDate = document.getElementById('extend-new-date').value;
            try {
                const response = await fetch('/api/loans/extend', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isbn, studentName: student, newReturnDate }) });
                if (!response.ok) throw new Error('Failed to extend loan');
                alert('تم تمديد فترة الإعارة بنجاح!');
                extendModal.style.display = 'none';
                await loadDataForPage(currentPage);
                await displayLoans(currentLoanType);
            } catch (error) {
                alert('خطأ في تمديد فترة الإعارة');
            }
        });
        
        document.getElementById('loan-isbn').addEventListener('change', async (e) => {
            const isbn = e.target.value.trim();
            const bookTitleElement = document.getElementById('loan-book-title');
            const availableCopiesDisplay = document.getElementById('available-copies-display');
            if (!isbn) { bookTitleElement.textContent = '-'; availableCopiesDisplay.textContent = '-'; return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/books/${isbn}`);
                if (!response.ok) throw new Error('Book not found');
                const book = await response.json();
                bookTitleElement.textContent = book.title;
                availableCopiesDisplay.textContent = book.availableCopies;
                loanForm.dataset.bookId = book._id;
                document.getElementById('loan-copies').max = book.availableCopies;
            } catch (error) {
                bookTitleElement.textContent = getTranslatedText('book_not_found');
                availableCopiesDisplay.textContent = '0';
                loanForm.dataset.bookId = '';
            }
        });

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => changeLanguage(btn.dataset.lang));
        });
    }

    // =================================================================================
    // 5. POINT D'ENTRÉE DE L'APPLICATION
    // =================================================================================
    if (localStorage.getItem('isLoggedIn') === 'true') {
        showDashboard().catch(err => {
            console.error('Erreur au démarrage:', err);
            alert("Une erreur critique est survenue. Vérifiez la console pour plus de détails.");
        });
    } else {
        loginPage.style.display = 'flex';
        initializeAllEventListeners();
        initializeBarcodeScanner();
    }
});
