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

app.post('/api/books/upload', upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Aucun fichier fourni' });

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        // defval: '' évite les undefined pour les cellules vides
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'Le fichier Excel est vide ou illisible.' });
        }

        // Normalisation des colonnes (gère les espaces, accents, variantes)
        const parsedRows = data.map(row => {
            // Nettoyage des clés (trim)
            const cleanRow = {};
            for (const key of Object.keys(row)) {
                cleanRow[key.trim()] = typeof row[key] === 'string' ? row[key].trim() : row[key];
            }

            const totalCopies = parseInt(
                cleanRow['Total Copies'] || cleanRow['TotalCopies'] ||
                cleanRow['Nombre de copies'] || cleanRow['total_copies'] || 1
            );
            const loanedCopies = parseInt(
                cleanRow['Copies Prêtées'] || cleanRow['Copies Pretees'] ||
                cleanRow['LoanedCopies'] || cleanRow['loaned_copies'] || 0
            );

            const safeTotal  = isNaN(totalCopies)  ? 1 : Math.max(0, totalCopies);
            const safeLoaned = isNaN(loanedCopies)  ? 0 : Math.max(0, loanedCopies);

            return {
                isbn:         String(cleanRow['ISBN']  || cleanRow['isbn']  || '').trim(),
                title:        String(cleanRow['Titre'] || cleanRow['Title'] || cleanRow['title'] || '').trim(),
                totalCopies:  safeTotal,
                loanedCopies: safeLoaned,
                availableCopies: Math.max(0, safeTotal - safeLoaned),
                subject:      String(cleanRow['Matière'] || cleanRow['Matiere'] || cleanRow['Subject'] || cleanRow['subject'] || ''),
                level:        String(cleanRow['Niveau'] || cleanRow['Level']   || cleanRow['level']   || ''),
                language:     String(cleanRow['Langue'] || cleanRow['Language'] || cleanRow['language'] || ''),
                cornerName:   String(cleanRow['Nom du Coin']    || cleanRow['Corner Name']   || cleanRow['CornerName']   || ''),
                cornerNumber: String(cleanRow['Numéro du Coin'] || cleanRow['Corner Number'] || cleanRow['CornerNumber'] || '')
            };
        }).filter(book => book.isbn && book.title);

        if (parsedRows.length === 0) {
            return res.status(400).json({ message: 'Aucune ligne valide trouvée (ISBN et Titre requis).' });
        }

        let addedCount   = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const bookData of parsedRows) {
            const existing = await Book.findOne({ isbn: bookData.isbn });

            if (!existing) {
                // ── Nouveau livre : insertion complète ──────────────────────────
                await Book.create({
                    ...bookData,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                addedCount++;
            } else {
                // ── Livre existant : comparer et mettre à jour si nécessaire ────
                const hasChanges =
                    existing.title        !== bookData.title        ||
                    existing.totalCopies  !== bookData.totalCopies  ||
                    existing.loanedCopies !== bookData.loanedCopies ||
                    existing.subject      !== bookData.subject      ||
                    existing.level        !== bookData.level        ||
                    existing.language     !== bookData.language     ||
                    existing.cornerName   !== bookData.cornerName   ||
                    existing.cornerNumber !== bookData.cornerNumber;

                if (hasChanges) {
                    // On ne touche pas aux copies prêtées gérées par le système
                    // sauf si l'Excel fournit explicitement la valeur
                    await Book.findOneAndUpdate(
                        { isbn: bookData.isbn },
                        {
                            $set: {
                                title:           bookData.title,
                                totalCopies:     bookData.totalCopies,
                                loanedCopies:    bookData.loanedCopies,
                                availableCopies: Math.max(0, bookData.totalCopies - bookData.loanedCopies),
                                subject:         bookData.subject,
                                level:           bookData.level,
                                language:        bookData.language,
                                cornerName:      bookData.cornerName,
                                cornerNumber:    bookData.cornerNumber,
                                updatedAt:       new Date()
                            }
                        }
                    );
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            }
        }

        res.json({
            message: `Import terminé avec succès.`,
            totalRows:    parsedRows.length,
            addedCount,
            updatedCount,
            skippedCount
        });

    } catch (error) {
        console.error("Erreur /api/books/upload:", error);
        res.status(500).json({ message: "Erreur lors de l'import", error: error.message });
    }
});

app.get('/api/export/excel', async (req, res) => {
    try {
        const books = await Book.find().lean();
        const loans = await getEnrichedLoans();
        const wb = xlsx.utils.book_new();
        const booksSheet = xlsx.utils.json_to_sheet(books.map(b => ({ ISBN: b.isbn, Titre: b.title, 'Total Copies': b.totalCopies, 'Copies Prêtées': b.loanedCopies, 'Copies Disponibles': b.availableCopies, Matière: b.subject, Niveau: b.level, Langue: b.language, 'Nom du Coin': b.cornerName, 'Numéro du Coin': b.cornerNumber })));
        const loansSheet = xlsx.utils.json_to_sheet(loans.map(l => ({ ISBN: l.isbn, 'Titre du Livre': l.title, 'Nom Emprunteur': l.studentName, Classe: l.studentClass, Type: l.borrowerType, 'Date Prêt': new Date(l.loanDate).toLocaleDateString(), 'Date Retour': new Date(l.returnDate).toLocaleDateString(), Copies: l.copiesCount })));
        xlsx.utils.book_append_sheet(wb, booksSheet, 'Livres');
        xlsx.utils.book_append_sheet(wb, loansSheet, 'Prêts');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=library_data.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
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
