/**
 * BIBLE API PROXY ROUTE
 * =====================
 * This route proxies requests to bible-api.com to avoid CORS issues.
 * It handles Bible passage lookups for multiple translations.
 */

import { NextResponse } from 'next/server';

// bible-api.com supported translations
const VALID_TRANSLATIONS = ['lsg', 'kjv', 'web', 'bbe', 'darby', 'aov', 'oeb-us', 'webbe', 'clementine'];

// Rate limiting (simple in-memory)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const data = requestCounts.get(ip);

    if (!data || now > data.resetAt) {
        requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return false;
    }

    if (data.count >= RATE_LIMIT) {
        return true;
    }

    data.count++;
    return false;
}

export async function GET(request: Request) {
    try {
        // Get query parameters
        const { searchParams } = new URL(request.url);
        const reference = searchParams.get('reference');
        const translation = searchParams.get('translation') || 'lsg'; // Default to French Louis Segond

        // Validate input
        if (!reference) {
            return NextResponse.json(
                { error: 'Missing required parameter: reference' },
                { status: 400 }
            );
        }

        // Validate translation
        if (!VALID_TRANSLATIONS.includes(translation)) {
            // Fallback to lsg if invalid
            console.warn(`Invalid translation ${translation}, falling back to lsg`);
        }

        // Construct API URL
        // bible-api.com format: https://bible-api.com/{reference}?translation={translation}
        const apiUrl = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;

        // Fetch from bible-api.com
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PrayerMarathonApp/1.0'
            },
            // Cache for 1 hour
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            // Try to get error message from API
            let errorMessage = `Bible API returned ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // Ignore JSON parse errors
            }

            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Return the data
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            }
        });

    } catch (error) {
        console.error('Bible API proxy error:', error);
        return NextResponse.json(
            { error: 'Internal server error while fetching Bible data' },
            { status: 500 }
        );
    }
}

// Health check endpoint
export async function HEAD() {
    return new Response(null, { status: 200 });
}
