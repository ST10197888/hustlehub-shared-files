const express = require('express');
const router = express.Router();
const { 
    createGig, 
    getAllGigs, 
    getGigById, 
    getMyGigs, 
    updateGig, 
    deleteGig 
} = require('../controllers/gigController');
const {
    createGigRules,
    updateGigRules,
    validateGigInput
} = require('../middleware/gigValidation');

// Import Member 1's authentication and RBAC middleware from their respective files[cite: 2, 6]
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

// Public / Marketplace routes[cite: 2, 3]
router.get('/', getAllGigs);
router.get('/my', authenticateToken, requireRole('freelancer'), getMyGigs);
router.get('/:id', getGigById);

// Freelancer-only protected routes[cite: 2, 3]
router.post('/', authenticateToken, requireRole('freelancer'), createGigRules, validateGigInput, createGig);
router.put('/:id', authenticateToken, requireRole('freelancer'), updateGigRules, validateGigInput, updateGig);
router.delete('/:id', authenticateToken, requireRole('freelancer'), deleteGig);

module.exports = router;