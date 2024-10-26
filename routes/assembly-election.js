const express = require('express');
const Joi = require('joi');
const AssemblyElection = require('../models/assembly-election.model');
const router = express.Router();

const electionSchema = Joi.object({
  year: Joi.string().required(),
  state: Joi.string().required(),
  total_seat: Joi.number().required(),
  total_votes: Joi.string().required(),
  total_candidate: Joi.number().required(),
  constituencies: Joi.array().optional().items(Joi.string().required()), // Assuming constituencies are ObjectId strings
});

// Create a new AssemblyElection
router.post('/', async (req, res) => {
  try {
    const { error } = electionSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const election = new AssemblyElection(req.body);
    await election.save();
    return res.status(201).redirect('/assembly-election');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Get all AssemblyElections
router.get('/', async (req, res) => {
  try {
    const elections = await AssemblyElection.find().populate('constituencies');
    res.json(elections);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Get an AssemblyElection by ID
router.get('/:id', async (req, res) => {
  try {
    const election = await AssemblyElection.findById(req.params.id).populate('constituencies');
    if (!election) return res.status(404).send('Election not found');
    res.json(election);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Update an AssemblyElection by ID
router.put('/:id', async (req, res) => {
  try {
    console.log(req.body)
    const { error } = electionSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const election = await AssemblyElection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!election) return res.status(404).send('Election not found');
    res.json(election);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Delete an AssemblyElection by ID
router.delete('/:id', async (req, res) => {
  try {
    const election = await AssemblyElection.findByIdAndDelete(req.params.id);
    if (!election) return res.status(404).send('Election not found');
    res.json({ message: 'Election deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// route with /state/:id 
router.get('/state/:name', async (req, res) => {
  try {
    console.log(req.params.name);
    
    const elections = await AssemblyElection.findOne({ state: req.params.name })
      .populate({
        path: 'constituencies',
        populate: {
          path: 'candidates',
          model: 'Candidate',
          populate: {
            path: 'party',
            model: 'Party',
          },
        },
      });

    if (!elections) return res.status(404).send('No elections found in this state');

    const constituencies = [];

    // Extract leading and trailing candidates and their party colors in each constituency
    elections.constituencies.forEach((constituency) => {
      // Check if candidates array is not empty before using reduce
      const highestVoteCandidate = constituency.candidates.length > 0 
        ? constituency.candidates.reduce((prev, current) =>
            prev.totalVotes > current.totalVotes ? prev : current
          )
        : null; // Set to null if no candidates

      const lowestVoteCandidate = constituency.candidates.length > 0 
        ? constituency.candidates.reduce((prev, current) =>
            prev.totalVotes < current.totalVotes ? prev : current
          )
        : null; // Set to null if no candidates

      // If no leading candidate, default to null values
      const leadingPartyColor = highestVoteCandidate ? highestVoteCandidate.party.color_code : null;
      const trailingPartyColor = lowestVoteCandidate ? lowestVoteCandidate.party.color_code : null;

      // Create a simplified version of the constituency object
      constituencies.push({
        _id: constituency._id, // Keeping only necessary fields
        name: constituency.name,
        state: constituency.state,
        totalVotes: constituency.totalVotes,
        color: leadingPartyColor,
        leadingCandidate: highestVoteCandidate
          ? {
              _id: highestVoteCandidate._id,
              name: highestVoteCandidate.name,
              totalVotes: highestVoteCandidate.totalVotes,
              party: {
                _id: highestVoteCandidate.party._id,
                party: highestVoteCandidate.party.party,
                color_code: leadingPartyColor,
                party_logo: highestVoteCandidate.party.party_logo,
              },
            }
          : null,
        trailingCandidate: lowestVoteCandidate
          ? {
              _id: lowestVoteCandidate._id,
              name: lowestVoteCandidate.name,
              totalVotes: lowestVoteCandidate.totalVotes,
              party: {
                _id: lowestVoteCandidate.party._id,
                party: lowestVoteCandidate.party.party,
                color_code: trailingPartyColor,
                party_logo: lowestVoteCandidate.party.party_logo,
              },
            }
          : null,
      });
    });

    res.json({
      state: elections.state,
      year: elections.year,
      total_seat: elections.total_seat,
      total_votes: elections.total_votes,
      total_candidate: elections.total_candidate,
      constituency: constituencies,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});


module.exports = router;
