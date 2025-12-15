"use client";

export interface CharacterForScanning {
    id: string;
    name: string;
    aliases?: unknown; // jsonb from DB
}

export interface SuggestedCharacter {
    characterId: string;
    characterName: string;
    matchedText: string;
    confidence: number; // 0.0 - 1.0
}

/**
 * Extract plain text from HTML content
 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Build search terms for a character (name + aliases)
 */
function getSearchTerms(character: CharacterForScanning): string[] {
    const terms: string[] = [character.name];

    if (character.aliases && Array.isArray(character.aliases)) {
        for (const alias of character.aliases) {
            if (typeof alias === 'string' && alias.trim()) {
                terms.push(alias.trim());
            }
        }
    }

    return terms;
}

/**
 * Scan text content for character mentions using simple CONTAINS matching
 * Similar to SQL: WHERE text LIKE '%term%'
 * 
 * @param htmlContent - The HTML content from the editor
 * @param characters - All characters with their aliases
 * @param confirmedCharacterIds - IDs of characters already confirmed in cast
 * @returns Array of suggested characters sorted by match length (longer = higher confidence)
 */
export function scanForCharacters(
    htmlContent: string,
    characters: CharacterForScanning[],
    confirmedCharacterIds: string[] = [],
): SuggestedCharacter[] {
    if (!htmlContent || characters.length === 0) {
        return [];
    }

    // Strip HTML and get plain text
    const plainText = stripHtml(htmlContent);
    if (!plainText) {
        return [];
    }

    const lowerText = plainText.toLowerCase();

    // Track found characters (dedupe by characterId, keep longest match)
    const foundMap = new Map<string, SuggestedCharacter>();

    // Check each character's name and aliases
    for (const character of characters) {
        // Skip if already confirmed
        if (confirmedCharacterIds.includes(character.id)) continue;

        const terms = getSearchTerms(character);

        for (const term of terms) {
            if (term.length < 2) continue; // Skip very short terms

            const termLower = term.toLowerCase();

            // Simple CONTAINS check: does text include this term?
            if (lowerText.includes(termLower)) {
                const existing = foundMap.get(character.id);

                // Calculate confidence based on term length (longer = more specific = higher confidence)
                const confidence = Math.min(1, term.length / 10);

                // Keep the longest matching term for this character
                if (!existing || term.length > existing.matchedText.length) {
                    foundMap.set(character.id, {
                        characterId: character.id,
                        characterName: character.name,
                        matchedText: term,
                        confidence,
                    });
                }
            }
        }
    }

    // Convert to array and sort by confidence (longest match first)
    const suggestions = Array.from(foundMap.values());
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
}

/**
 * Debounce utility for real-time scanning
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
        }, delay);
    };
}
