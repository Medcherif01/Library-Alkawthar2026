require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration Express et CORS ---
app.use(cors({
    origin: ['https://library-alkawthar-seven.vercel.app', 'https://library-alkawthar.vercel.app', 'http://localhost:3000', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const upload = multer({ dest: '/tmp/uploads', limits: { fileSize: 10 * 1024 * 1024 } });

// --- Servir les fichiers statiques depuis le dossier public ---
app.use(express.static(path.join(__dirname, '../public')));

// --- GESTION DE LA CONNEXION MONGODB ROBUSTE ---
const MONGODB_URI = process.env.MONGODB_URI;
let isConnected = false;

async function connectToDb() {
    if (isConnected && mongoose.connection.readyState === 1) {
        return;
    }

    try {
        console.log('=> Tentative de connexion à MongoDB...');
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB connecté avec succès');

        mongoose.connection.on('error', err => {
            console.error('❌ Erreur de connexion MongoDB après connexion initiale:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB déconnecté.');
            isConnected = false;
        });

    } catch (error) {
        console.error('❌ ÉCHEC de la connexion initiale à MongoDB:', error.message);
        isConnected = false;
        // Ne fait pas planter le serveur
    }
}

// Middleware pour assurer la connexion avant chaque requête API
app.use('/api', async (req, res, next) => {
    await connectToDb();
    if (!isConnected) {
        return res.status(503).json({ message: "Service non disponible : impossible de se connecter à la base de données." });
    }
    next();
});

// --- Schémas MongoDB ---
const BookSchema = new mongoose.Schema({ isbn: { type: String, required: true }, title: { type: String, required: true }, totalCopies: { type: Number, default: 1 }, loanedCopies: { type: Number, default: 0 }, availableCopies: { type: Number, default: 1 }, subject: String, level: String, language: String, cornerName: String, cornerNumber: String, createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now } });
BookSchema.index({ isbn: 1 });
// Index composé isbn+title pour identifier chaque livre de façon unique (même ISBN peut avoir plusieurs titres/coins)
BookSchema.index({ isbn: 1, title: 1 });
BookSchema.index({ title: 'text', subject: 'text' });
const LoanSchema = new mongoose.Schema({ bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }, isbn: { type: String, required: true }, studentName: { type: String, required: true }, studentClass: String, borrowerType: { type: String, enum: ['student', 'teacher'], default: 'student' }, loanDate: { type: Date, default: Date.now }, returnDate: { type: Date, required: true }, copiesCount: { type: Number, default: 1 }, createdAt: { type: Date, default: Date.now } });
LoanSchema.index({ bookId: 1, studentName: 1 });
const HistorySchema = new mongoose.Schema({ bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' }, isbn: String, studentName: String, studentClass: String, borrowerType: String, loanDate: Date, returnDate: Date, actualReturnDate: { type: Date, default: Date.now }, copiesCount: { type: Number, default: 1 } });
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Loan = mongoose.models.Loan || mongoose.model('Loan', LoanSchema);
const History = mongoose.models.History || mongoose.model('History', HistorySchema);

// --- ROUTES API ---

app.get('/api', (req, res) => {
    res.send(`<h2>📚 Al-Kawthar Library API</h2><p>Le serveur fonctionne.</p>`);
});

app.get('/api/statistics', async (req, res) => {
    try {
        const totalBooks = await Book.countDocuments();
        const stats = await Book.aggregate([ { $group: { _id: null, totalCopies: { $sum: '$totalCopies' }, loanedCopies: { $sum: '$loanedCopies' } } } ]);
        const activeLoans = await Loan.countDocuments();
        const { totalCopies = 0, loanedCopies = 0 } = stats[0] || {};
        res.json({ totalBooks, totalCopies, loanedCopies, availableCopies: totalCopies - loanedCopies, activeLoans });
    } catch (error) {
        console.error("Erreur /api/statistics:", error);
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

const getEnrichedLoans = async (filter = {}) => {
    const loans = await Loan.find(filter).lean();
    const bookIds = loans.map(loan => loan.bookId).filter(id => id);
    if (bookIds.length === 0) return loans;
    const books = await Book.find({ _id: { $in: bookIds } }).select('title').lean();
    const bookTitleMap = books.reduce((map, book) => { map[book._id.toString()] = book.title; return map; }, {});
    return loans.map(loan => ({ ...loan, title: loan.bookId ? bookTitleMap[loan.bookId.toString()] : 'Livre non trouvé' }));
};
app.get('/api/loans', (req, res) => getEnrichedLoans({}).then(data => res.json(data)).catch(err => res.status(500).json({ message: err.message })));
app.get('/api/loans/students', (req, res) => getEnrichedLoans({ borrowerType: 'student' }).then(data => res.json(data)).catch(err => res.status(500).json({ message: err.message })));
app.get('/api/loans/teachers', (req, res) => getEnrichedLoans({ borrowerType: 'teacher' }).then(data => res.json(data)).catch(err => res.status(500).json({ message: err.message })));

app.get('/api/books', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        let query = {};
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query = { $or: [{ title: searchRegex }, { isbn: searchRegex }, { subject: searchRegex }] };
        }
        const totalBooks = await Book.countDocuments(query);
        const totalPages = Math.ceil(totalBooks / limit);
        const books = await Book.find(query).sort({ title: 1 }).skip(skip).limit(limit).lean();
        res.json({ books, totalBooks, totalPages, currentPage: page });
    } catch (error) {
        console.error('❌ Erreur /api/books:', error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des livres", error: error.message });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let book = mongoose.Types.ObjectId.isValid(id) ? await Book.findById(id).lean() : await Book.findOne({ isbn: id }).lean();
        if (book) {
            // Recalcul robuste pour garantir la cohérence des données renvoyées.
            const correctAvailableCopies = book.totalCopies - book.loanedCopies;
            if (book.availableCopies !== correctAvailableCopies) {
                console.warn(`Incohérence détectée pour le livre ${book._id}: copies disponibles stockées ${book.availableCopies}, calculées ${correctAvailableCopies}.`);
                book.availableCopies = correctAvailableCopies;
            }
            res.json(book);
        } else {
            res.status(404).json({ message: 'Livre non trouvé' });
        }
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

app.post('/api/books', async (req, res) => {
    try {
        const { isbn, title, totalCopies = 1, ...rest } = req.body;
        const newBook = new Book({ isbn, title, totalCopies: parseInt(totalCopies), availableCopies: parseInt(totalCopies), loanedCopies: 0, ...rest });
        await newBook.save();
        res.status(201).json({ message: 'Livre ajouté avec succès', book: newBook });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'ajout", error: error.message });
    }
});

app.put('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body, updatedAt: new Date() };
        const book = await Book.findByIdAndUpdate(id, updateData, { new: true });
        if (!book) return res.status(404).json({ message: 'Livre non trouvé' });
        if (updateData.totalCopies !== undefined) {
            book.availableCopies = book.totalCopies - book.loanedCopies;
            await book.save();
        }
        res.json({ message: 'Livre mis à jour', book });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la mise à jour", error: error.message });
    }
});

app.delete('/api/books/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Livre non trouvé' });
        if (book.loanedCopies > 0) return res.status(400).json({ message: `Impossible de supprimer: ${book.loanedCopies} copies sont prêtées` });
        await Book.deleteOne({ _id: book._id });
        res.json({ message: 'Livre supprimé' });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression", error: error.message });
    }
});

app.post('/api/loans', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { bookId, copiesCount = 1, ...rest } = req.body;

        const book = await Book.findById(bookId).session(session);
        if (!book) {
            throw new Error('Livre non trouvé');
        }

        const numCopies = parseInt(copiesCount);
        
        // --- DÉBUT DE LA CORRECTION ---
        // Ancien code (incorrect) : if (book.availableCopies < numCopies)
        // Nouveau code : On recalcule la disponibilité réelle pour être certain.
        const actualAvailableCopies = book.totalCopies - book.loanedCopies;
        
        if (actualAvailableCopies < numCopies) {
            // On utilise la valeur fraîchement calculée dans le message d'erreur
            throw new Error(`Pas assez de copies. Disponibles: ${actualAvailableCopies}`);
        }
        // --- FIN DE LA CORRECTION ---

        const newLoan = new Loan({ bookId, isbn: book.isbn, copiesCount: numCopies, ...rest });
        await newLoan.save({ session });

        book.loanedCopies += numCopies;
        book.availableCopies -= numCopies; // Maintenu pour la performance des requêtes générales
        await book.save({ session });

        await session.commitTransaction();
        res.status(201).json({ message: 'Prêt créé', loan: newLoan });
    } catch (error) {
        await session.abortTransaction();
        // Renvoyer un statut 400 (Bad Request) pour les erreurs de logique métier
        if (error.message.startsWith('Pas assez de copies')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});
app.delete('/api/loans', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { isbn, studentName } = req.body;
        const loan = await Loan.findOne({ isbn, studentName }).session(session);
        if (!loan) throw new Error('Prêt non trouvé');
        const book = await Book.findById(loan.bookId).session(session);
        if (book) {
            const copies = loan.copiesCount || 1;
            book.loanedCopies = Math.max(0, book.loanedCopies - copies);
            book.availableCopies = book.totalCopies - book.loanedCopies;
            await book.save({ session });
        }
        const historyEntry = new History({ ...loan.toObject(), _id: undefined, __v: undefined, actualReturnDate: new Date() });
        await historyEntry.save({ session });
        await Loan.deleteOne({ _id: loan._id }).session(session);
        await session.commitTransaction();
        res.json({ message: 'Livre retourné' });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

app.put('/api/loans/extend', async (req, res) => {
    try {
        const { isbn, studentName, newReturnDate } = req.body;
        const loan = await Loan.findOneAndUpdate({ isbn, studentName }, { returnDate: newReturnDate }, { new: true });
        if (!loan) return res.status(404).json({ message: 'Prêt non trouvé' });
        res.json({ message: 'Date mise à jour', loan });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'extension", error: error.message });
    }
});

// ─── Utilitaire : parse une date Excel (nombre, string JJ/MM/AAAA, ISO…) ───────
function parseExcelDate(val) {
    if (!val) return null;
    // Nombre sériel Excel (ex: 45678)
    if (typeof val === 'number') {
        const parsed = xlsx.SSF.parse_date_code(val);
        if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
    const str = String(val).trim();
    // Format JJ/MM/AAAA ou JJ-MM-AAAA
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    // Format AAAA-MM-JJ (ISO)
    const iso = new Date(str);
    return isNaN(iso.getTime()) ? null : iso;
}

app.post('/api/books/upload', upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Aucun fichier fourni' });

        const workbook = xlsx.readFile(req.file.path);
        const now = new Date();

        // ════════════════════════════════════════════════════════════════════════
        // 1. FEUILLE LIVRES  (1ère feuille ou nommée "Livres")
        // ════════════════════════════════════════════════════════════════════════
        const booksSheetName = workbook.SheetNames.find(n =>
            /livres?|books?/i.test(n)
        ) || workbook.SheetNames[0];

        const booksData = xlsx.utils.sheet_to_json(workbook.Sheets[booksSheetName], { defval: '' });

        let booksAddedCount = 0, booksUpdatedCount = 0, booksSkippedCount = 0;

        if (booksData && booksData.length > 0) {
            const parsedBooks = booksData.map(row => {
                const c = {};
                for (const key of Object.keys(row)) {
                    // Normalise la clé : trim + collapse espaces multiples
                    const k = key.trim().replace(/\s+/g, ' ');
                    c[k] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                }

                // Lecture robuste : accepte valeur 0 sans la confondre avec "vide"
                const getRaw = (...keys) => {
                    for (const k of keys) {
                        if (c[k] !== undefined && c[k] !== '') return c[k];
                    }
                    return undefined;
                };

                const totalRaw  = getRaw('Total Copies','TotalCopies','total_copies');
                const loanedRaw = getRaw('Copies Prêtées','Copies Pretees','LoanedCopies','loaned_copies');
                const totalCopies  = parseInt(totalRaw  ?? 1);
                const loanedCopies = parseInt(loanedRaw ?? 0);
                const safeTotal    = isNaN(totalCopies)  ? 1 : Math.max(0, totalCopies);
                const safeLoaned   = isNaN(loanedCopies) ? 0 : Math.max(0, loanedCopies);

                const isbn  = String(getRaw('ISBN','isbn')  ?? '').trim();
                const title = String(getRaw('Titre','Title','title') ?? '').trim();

                return {
                    isbn,
                    title,
                    totalCopies:     safeTotal,
                    loanedCopies:    safeLoaned,
                    availableCopies: Math.max(0, safeTotal - safeLoaned),
                    subject:      String(getRaw('Matière','Matiere','Subject','subject') ?? ''),
                    level:        String(getRaw('Niveau','Level','level')               ?? ''),
                    language:     String(getRaw('Langue','Language','language')         ?? ''),
                    cornerName:   String(getRaw('Nom du Coin','Corner Name','CornerName')           ?? ''),
                    cornerNumber: String(getRaw('Numéro du Coin','Numero du Coin','Corner Number','CornerNumber') ?? '')
                };
            }).filter(b => b.isbn && b.title);  // lignes sans ISBN ET sans titre → ignorées

            // ── Dédoublonnage dans le fichier Excel lui-même ──────────────────────
            // Si deux lignes ont exactement le même ISBN+Titre, on garde la dernière
            // (elle a peut-être des données plus récentes)
            const dedupMap = new Map();
            for (const book of parsedBooks) {
                const key = `${book.isbn}|||${book.title}`;
                dedupMap.set(key, book);   // écrase → on garde la dernière occurrence
            }
            const uniqueBooks = Array.from(dedupMap.values());

            if (uniqueBooks.length > 0) {
                // ── bulkWrite avec clé composite isbn + title ─────────────────────
                // Cela permet :
                //   • même ISBN, titres différents  → 2 documents séparés ✅
                //   • même titre, ISBN différents   → 2 documents séparés ✅
                //   • même ISBN + même titre        → mise à jour (upsert) ✅
                const bulkBooks = uniqueBooks.map(book => ({
                    updateOne: {
                        filter: { isbn: book.isbn, title: book.title },
                        update: {
                            $set: {
                                totalCopies:     book.totalCopies,
                                loanedCopies:    book.loanedCopies,
                                availableCopies: book.availableCopies,
                                subject:         book.subject,
                                level:           book.level,
                                language:        book.language,
                                cornerName:      book.cornerName,
                                cornerNumber:    book.cornerNumber,
                                updatedAt:       now
                            },
                            $setOnInsert: { isbn: book.isbn, title: book.title, createdAt: now }
                        },
                        upsert: true
                    }
                }));

                const rBooks = await Book.bulkWrite(bulkBooks, { ordered: false });
                booksAddedCount   = rBooks.upsertedCount  || 0;
                booksUpdatedCount = rBooks.modifiedCount  || 0;
                booksSkippedCount = Math.max(0, uniqueBooks.length - booksAddedCount - booksUpdatedCount);
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // 2. FEUILLE EMPRUNTS  (nommée "Emprunts", "Prêts", "Loans"…)
        // ════════════════════════════════════════════════════════════════════════
        const loansSheetName = workbook.SheetNames.find(n =>
            /emprunts?|pr[eê]ts?|loans?/i.test(n)
        );

        let loansAddedCount = 0, loansSkippedCount = 0, loansErrors = 0;

        if (loansSheetName) {
            const loansData = xlsx.utils.sheet_to_json(workbook.Sheets[loansSheetName], { defval: '' });

            const parsedLoans = loansData.map(row => {
                const c = {};
                for (const key of Object.keys(row)) {
                    c[key.trim()] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                }
                const borrowerTypeRaw = String(
                    c['Type Emprunteur'] || c['Type'] || c['borrowerType'] || 'student'
                ).toLowerCase().trim();
                const borrowerType = (borrowerTypeRaw === 'teacher' || borrowerTypeRaw === 'enseignant' ||
                    borrowerTypeRaw === 'prof' || borrowerTypeRaw === 'professeur') ? 'teacher' : 'student';

                return {
                    isbn:         String(c['ISBN'] || c['isbn'] || '').trim(),
                    studentName:  String(c['Nom Emprunteur'] || c['Nom'] || c['studentName'] || '').trim(),
                    studentClass: String(c['Classe/Matière'] || c['Classe'] || c['Matière'] || c['studentClass'] || '').trim(),
                    borrowerType,
                    loanDate:     parseExcelDate(c['Date Emprunt'] || c['Date Prêt'] || c['loanDate']),
                    returnDate:   parseExcelDate(c['Date Retour']  || c['returnDate']),
                    copiesCount:  Math.max(1, parseInt(c['Nombre Copies'] || c['Copies'] || c['copiesCount'] || 1) || 1)
                };
            }).filter(l => l.isbn && l.studentName && l.returnDate);

            // Traiter les emprunts en une passe (bulkWrite sur Loan)
            for (const loanData of parsedLoans) {
                try {
                    // Trouver le livre par ISBN
                    const book = await Book.findOne({ isbn: loanData.isbn });
                    if (!book) { loansErrors++; continue; }

                    // Vérifier si cet emprunt existe déjà (même ISBN + même emprunteur)
                    const existingLoan = await Loan.findOne({
                        isbn: loanData.isbn,
                        studentName: loanData.studentName
                    });

                    if (existingLoan) {
                        loansSkippedCount++;
                        continue;
                    }

                    // Créer l'emprunt
                    const loanDate    = loanData.loanDate || now;
                    await Loan.create({
                        bookId:       book._id,
                        isbn:         loanData.isbn,
                        studentName:  loanData.studentName,
                        studentClass: loanData.studentClass,
                        borrowerType: loanData.borrowerType,
                        loanDate,
                        returnDate:   loanData.returnDate,
                        copiesCount:  loanData.copiesCount,
                        createdAt:    now
                    });

                    // Mettre à jour les compteurs du livre
                    book.loanedCopies    = (book.loanedCopies || 0) + loanData.copiesCount;
                    book.availableCopies = Math.max(0, book.totalCopies - book.loanedCopies);
                    await book.save();

                    loansAddedCount++;
                } catch (e) {
                    console.error('Erreur import emprunt:', e.message);
                    loansErrors++;
                }
            }
        }

        res.json({
            message: 'Import terminé avec succès.',
            books: {
                totalRows:    booksAddedCount + booksUpdatedCount + booksSkippedCount,
                addedCount:   booksAddedCount,
                updatedCount: booksUpdatedCount,
                skippedCount: booksSkippedCount
            },
            loans: loansSheetName ? {
                addedCount:   loansAddedCount,
                skippedCount: loansSkippedCount,
                errorCount:   loansErrors
            } : null
        });

    } catch (error) {
        console.error("Erreur /api/books/upload:", error);
        res.status(500).json({ message: "Erreur lors de l'import", error: error.message });
    }
});

app.get('/api/export/excel', async (req, res) => {
    try {
        const books = await Book.find().sort({ title: 1 }).lean();
        const loans = await getEnrichedLoans();
        const wb = xlsx.utils.book_new();

        // Format de date JJ/MM/AAAA — identique à ce qu'on attend à l'import
        const fmtDate = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            const dd = String(dt.getDate()).padStart(2, '0');
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const yyyy = dt.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

        // ── Feuille 1 : Livres ── colonnes = exactement celles attendues à l'import
        const booksSheet = xlsx.utils.json_to_sheet(
            books.map(b => ({
                'ISBN':             b.isbn          || '',
                'Titre':            b.title         || '',
                'Total Copies':     b.totalCopies   ?? 0,
                'Copies Prêtées':   b.loanedCopies  ?? 0,
                'Copies Disponibles': b.availableCopies ?? 0,
                'Matière':          b.subject       || '',
                'Niveau':           b.level         || '',
                'Langue':           b.language      || '',
                'Nom du Coin':      b.cornerName    || '',
                'Numéro du Coin':   b.cornerNumber  || ''
            }))
        );

        // ── Feuille 2 : Emprunts ── colonnes = exactement celles attendues à l'import
        const loansSheet = xlsx.utils.json_to_sheet(
            loans.map(l => ({
                'ISBN':             l.isbn          || '',
                'Titre du Livre':   l.title         || '',
                'Nom Emprunteur':   l.studentName   || '',
                'Type Emprunteur':  l.borrowerType  === 'teacher' ? 'teacher' : 'student',
                'Classe/Matière':   l.studentClass  || '',
                'Date Emprunt':     fmtDate(l.loanDate),
                'Date Retour':      fmtDate(l.returnDate),
                'Nombre Copies':    l.copiesCount   ?? 1
            }))
        );

        xlsx.utils.book_append_sheet(wb, booksSheet,  'Livres');
        xlsx.utils.book_append_sheet(wb, loansSheet,  'Emprunts');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const filename = `bibliotheque_alkawthar_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error("Erreur /api/export/excel:", error);
        res.status(500).json({ message: "Erreur lors de l'export", error: error.message });
    }
});

app.get('/api/history/book/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let query = mongoose.Types.ObjectId.isValid(id) ? { bookId: id } : { isbn: id };
        const history = await History.find(query).sort({ actualReturnDate: -1 }).lean();
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: "Erreur récupération historique", error: error.message });
    }
});


// --- Démarrage du serveur en mode développement local ---
if (require.main === module) {
    connectToDb().then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Serveur démarré sur le port ${PORT}`);
            console.log(`🌍 Accédez au site: http://localhost:${PORT}`);
        });
    });
}

// --- Export pour Vercel ---
module.exports = app;
