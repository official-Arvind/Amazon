/**
 * CJ Dropshipping API Integration
 * This module handles authentication and data retrieval from the CJ Dropshipping API.
 */

const CJ_API_KEY = "CJ5482349@api@01cc1ed93dd24699b2f085de28e0aacd";
const CJ_API_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

let accessToken = null;
let tokenExpiry = null;

/**
 * Get an access token from CJ Dropshipping.
 * @returns {Promise<string>} The access token
 */
export async function getCjAccessToken() {
    // If we have a valid token, return it
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    try {
        const response = await fetch(`${CJ_API_BASE}/authentication/getAccessToken`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: CJ_API_KEY
            })
        });

        const result = await response.json();
        
        if (result.code === 200 && result.data) {
            accessToken = result.data.accessToken;
            // Token is usually valid for 180 days, but we'll cache it in memory for this session
            tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
            return accessToken;
        } else {
            throw new Error(result.message || "Failed to retrieve access token");
        }
    } catch (error) {
        console.error("CJ API Auth Error:", error);
        throw error;
    }
}

/**
 * Fetch a list of products from CJ Dropshipping using the V2 endpoint.
 * @param {number} page - Page number (default: 1)
 * @param {number} size - Results per page (default: 20)
 * @param {string} keyword - Optional search keyword
 * @returns {Promise<Array>} Array of product objects
 */
export async function fetchCjProducts(page = 1, size = 20, keyword = "") {
    try {
        const token = await getCjAccessToken();
        
        // Construct query parameters
        let url = `${CJ_API_BASE}/product/listV2?page=${page}&size=${size}`;
        if (keyword) {
            url += `&keyWord=${encodeURIComponent(keyword)}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'CJ-Access-Token': token,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        
        if (result.code === 200 && result.data && result.data.list) {
            return result.data.list;
        } else {
            throw new Error(result.message || "Failed to fetch products");
        }
    } catch (error) {
        console.error("CJ API Product Fetch Error:", error);
        throw error;
    }
}
