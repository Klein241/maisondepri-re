/**
 * Script pour normaliser les noms de fichiers Bible
 * Convertit les majuscules en minuscules et supprime les accents
 */

const fs = require('fs');
const path = require('path');

const directories = [
    path.join(__dirname, '..', 'public', 'bible', 'fr', 'at'),
    path.join(__dirname, '..', 'public', 'bible', 'fr', 'nt')
];

// Fonction pour normaliser un nom de fichier
function normalizeFilename(filename) {
    // Convertir en minuscules
    let normalized = filename.toLowerCase();

    // Remplacer les caractères accentués
    const accentsMap = {
        'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a',
        'è': 'e', 'ê': 'e', 'ë': 'e', 'é': 'e',
        'ì': 'i', 'î': 'i', 'ï': 'i', 'í': 'i',
        'ò': 'o', 'ô': 'o', 'ö': 'o', 'ó': 'o',
        'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
        'ÿ': 'y', 'ý': 'y',
        'ñ': 'n', 'ç': 'c'
    };

    for (const [accent, replacement] of Object.entries(accentsMap)) {
        normalized = normalized.replace(new RegExp(accent, 'g'), replacement);
    }

    return normalized;
}

let totalRenamed = 0;
let errors = [];

for (const dir of directories) {
    console.log(`\nProcessing directory: ${dir}`);

    if (!fs.existsSync(dir)) {
        console.log(`Directory does not exist: ${dir}`);
        continue;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const normalized = normalizeFilename(file);

        if (file !== normalized) {
            const oldPath = path.join(dir, file);
            const newPath = path.join(dir, normalized);

            try {
                // Check if target already exists
                if (fs.existsSync(newPath)) {
                    // If both exist, delete the duplicate
                    console.log(`Skipping duplicate: ${file} -> ${normalized} (target exists)`);
                    // fs.unlinkSync(oldPath);
                    continue;
                }

                fs.renameSync(oldPath, newPath);
                console.log(`Renamed: ${file} -> ${normalized}`);
                totalRenamed++;
            } catch (err) {
                errors.push({ file, error: err.message });
                console.error(`Error renaming ${file}: ${err.message}`);
            }
        }
    }
}

console.log(`\n=== Summary ===`);
console.log(`Total files renamed: ${totalRenamed}`);
console.log(`Errors: ${errors.length}`);

if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
}

console.log('\nDone!');
