# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: 66f78085-ad5c-4786-bce1-1ea282b5150c -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [x] Step: Project Setup and Dependencies
<!-- chat-id: 1870fff8-da8e-43d4-976b-c512dc626466 -->

Install and configure required dependencies for the Socket.IO server.

Tasks:
- [ ] Add socket.io dependency to package.json
- [ ] Add cors dependency for cross-origin support
- [ ] Create basic project structure (src/ directory)
- [ ] Add npm scripts (start, dev) to package.json
- [ ] Install dependencies with npm install

Verification:
- Verify package.json has socket.io and cors listed
- Verify node_modules contains new dependencies

---

### [x] Step: Core Models and Utilities
<!-- chat-id: 9eb6f0b3-d11e-4b3e-9d99-1fa1883c972a -->

Create data models and utility functions for session and player management.

Tasks:
- [ ] Create src/utils/codeGenerator.js for 8-digit join code generation
- [ ] Create src/models/Player.js class/constructor
- [ ] Create src/models/Session.js class/constructor
- [ ] Ensure code generator produces unique alphanumeric codes

Verification:
- Test code generator produces valid 8-character codes
- Verify Session and Player models have correct properties

---

### [x] Step: Session Manager
<!-- chat-id: 87e91b5f-0702-4c39-af4f-7844253f940f -->

Implement session management logic with in-memory storage.

Tasks:
- [ ] Create src/sessionManager.js
- [ ] Implement sessions Map storage
- [ ] Implement createSession() function
- [ ] Implement getSession(joinCode) function
- [ ] Implement addPlayerToSession(joinCode, player) function
- [ ] Implement removePlayerFromSession(joinCode, playerId) function

Verification:
- Test creating multiple sessions with unique codes
- Test retrieving sessions by join code
- Test adding/removing players from sessions

---

### [x] Step: HTTP Endpoint - Create Session
<!-- chat-id: aa7d426f-163f-4eac-bb11-4c734c170c8c -->

Implement the REST endpoint for creating new game sessions.

Tasks:
- [ ] Create src/server.js with Express setup
- [ ] Configure Express middleware (json, cors)
- [ ] Implement POST /api/session/create endpoint
- [ ] Return joinCode in response
- [ ] Handle errors appropriately

Verification:
- Start server successfully
- Test POST /api/session/create with curl or Postman
- Verify response contains valid joinCode

---

### [x] Step: Socket.IO Integration
<!-- chat-id: 30764801-221a-4e51-87a0-b7390b341317 -->

Set up Socket.IO server and implement join session functionality.

Tasks:
- [ ] Integrate socket.io with Express server in server.js
- [ ] Implement 'join-session' event handler
  - Validate join code
  - Add player to session
  - Join socket to room
  - Emit success/error responses
- [ ] Implement 'disconnect' event handler for cleanup
- [ ] Broadcast player-joined events to room participants

Verification:
- Test socket connection establishes successfully
- Test joining with valid join code returns player list
- Test joining with invalid code returns error
- Test multiple clients can join same session
- Verify disconnect removes player from session

---

### [ ] Step: Testing and Final Verification

Perform comprehensive testing and create completion report.

Tasks:
- [ ] Manual test complete flow (create → join → multiple players)
- [ ] Test edge cases (invalid codes, disconnects, empty sessions)
- [ ] Run linter if configured
- [ ] Document any issues encountered
- [ ] Write report to `{@artifacts_path}/report.md`

Verification:
- All endpoints respond correctly
- Multiple clients can interact in real-time
- No console errors or warnings
- Code follows project conventions
