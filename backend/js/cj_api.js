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
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    try {
        const response = await fetch(`${CJ_API_BASE}/authentication/getAccessToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: CJ_API_KEY })
        });

        const result = await response.json();
        console.log('CJ Auth Response:', JSON.stringify(result));

        if (result.code === 200 && result.data) {
            accessToken = result.data.accessToken;
            tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
            console.log('CJ Access Token obtained successfully');
            return accessToken;
        } else {
            throw new Error(result.message || `Auth failed with code ${result.code}`);
        }
    } catch (error) {
        console.error("CJ API Auth Error:", error);
        throw error;
    }
}

/**
 * Fetch a list of products from CJ Dropshipping.
 * Handles multiple response shapes from the API.
 * @param {number} page - Page number (default: 1)
 * @param {number} size - Results per page (default: 20)
 * @param {string} keyword - Optional search keyword
 * @returns {Promise<Array>} Array of product objects
 */
export async function fetchCjProducts(page = 1, size = 20, keyword = "") {
    try {
        const token = await getCjAccessToken();

        let url = `${CJ_API_BASE}/product/listV2?pageNum=${page}&pageSize=${size}`;
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
        console.log('CJ Products Response code:', result.code, '| message:', result.message);

        if (result.code === 200) {
            // The API may return data in different shapes — handle all of them
            const data = result.data;
            if (Array.isArray(data)) {
                return data;
            } else if (data && Array.isArray(data.list)) {
                return data.list;
            } else if (data && Array.isArray(data.products)) {
                return data.products;
            } else {
                // If no list found but code is 200, store is not verified yet
                console.warn("CJ API: No product list found. Your store may need verification on CJ platform.");
                return [];
            }
        } else {
            // The "Error: Success" bug was here — message was "Success" but code wasn't 200
            console.error("CJ API returned unexpected response:", result);
            throw new Error(result.message || `API error code: ${result.code}`);
        }
    } catch (error) {
        console.error("CJ API Product Fetch Error:", error);
        throw error;
    }
}

/**
 * Push an order to CJ Dropshipping for fulfillment.
 * Uses payType=3 (Create order only, no payment deduction).
 * @param {Object} orderData Our Firebase order object
 * @returns {Promise<Object>} The created CJ order data
 */
export async function createCjOrder(orderData) {
    try {
        const token = await getCjAccessToken();

        const cjProducts = orderData.items.map(item => ({
            vid: item.cjProductId || item.productId,
            quantity: item.quantity,
            storeLineItemId: item.productId
        }));

        const cjPayload = {
            orderNumber: orderData.orderNumber,
            shippingCustomerName: orderData.shippingAddress?.name || 'Customer',
            shippingAddress: orderData.shippingAddress?.street || '123 Main St',
            shippingCity: orderData.shippingAddress?.city || 'New York',
            shippingProvince: orderData.shippingAddress?.state || 'NY',
            shippingCountryCode: 'IN',
            shippingCountry: 'India',
            shippingZip: orderData.shippingAddress?.zip || '110001',
            shippingPhone: orderData.shippingAddress?.phone || '9999999999',
            logisticName: "CJPacket",
            fromCountryCode: "CN",
            platform: "custom",
            payType: 3,
            products: cjProducts
        };

        console.log('Creating CJ Order with payload:', JSON.stringify(cjPayload));

        const response = await fetch(`${CJ_API_BASE}/shopping/order/createOrderV2`, {
            method: 'POST',
            headers: {
                'CJ-Access-Token': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cjPayload)
        });

        const result = await response.json();
        console.log('CJ Create Order Response:', JSON.stringify(result));

        if (result.code === 200) {
            return result.data;
        } else {
            throw new Error(result.message || "Failed to create order on CJ Dropshipping");
        }
    } catch (error) {
        console.error("CJ API Create Order Error:", error);
        throw error;
    }
}
