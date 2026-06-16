### Specification for AI Agent: Project Manager Roadmap Application

#### 1. Overview
The AI agent shall generate a fully functional web application that enables project managers to plan, track, and visualize project roadmaps. The application must support interactive timeline management, task grouping, milestone tracking, dual‑timeline visualization (indicative vs. committed), full historical logging, multi‑style roadmap views, and structured data entry. The entire solution must be delivered as a Docker‑containerized application, accessible via `http://localhost` by default.

#### 2. Functional Requirements

##### 2.1 Task Date and Duration Adjustment
- Users must be able to modify the start date, end date, and duration of any task or work item directly on the roadmap (e.g., by dragging task bars) and through a property editor.
- Duration changes shall cascade appropriately based on task dependencies (e.g., auto‑shift successors if a predecessor’s end date moves).

##### 2.2 Completion Marking
- Each task shall support partial completion: users can mark individual sub‑stages or checkpoints within a task as “done”.
- A task can be marked as fully completed in one action (e.g., a checkbox or status toggle), which will also mark all remaining sub‑stages as finished.
- Visual indication (progress bar, strikethrough, or green checkmark) must clearly communicate completion percentage.

##### 2.3 Task Grouping by Category
- The application shall allow grouping tasks by custom categories (e.g., “Transactional data marts”, “Accounting data marts”, “Non‑transactional data marts”, etc.).
- Grouping can be displayed in two ways, selectable by the user:
  - **Color coding:** all tasks belonging to a category share the same background or border color.
  - **Area division:** the roadmap canvas is split into horizontal/vertical swimlanes, each representing one category.
- Users must be able to define, edit, and delete categories, and assign a color to each.

##### 2.4 Additional Milestones
- Users must be able to place extra milestone markers on the timeline that are not tied to a regular task.
- A milestone shall have a name, a fixed date, and optionally a description.
- Milestones should be visually distinct (e.g., diamond shape) and draggable along the timeline.

##### 2.5 Indicative vs. Detailed Timelines
- Tasks shall support two kinds of deadlines:
  - **Detailed (committed) plan:** defined by a firm start and end date.
  - **Indicative (tentative) plan:** a less certain timeframe that may be broader or preliminary.
- On the roadmap, committed timeframes are rendered with **solid borders/lines**, and indicative timeframes with **dashed or dotted borders/lines**.
- A single task can have both an indicative envelope and a detailed bar inside it, or the two timelines can be shown as separate parallel bars.
- The user can toggle the visibility of indicative timelines.

##### 2.6 History, Comments, Cost and Effort Logging
- The system must maintain an immutable history of every change made to task dates (start, end, duration), including timestamp and user identification.
- Users shall be able to add free‑text comments to any task; comments are stored with timestamps and displayed in a chronological activity log.
- Each task must have fields for planned/actual cost (monetary) and planned/actual labor effort (hours/man‑days).
- Changes to cost and effort fields are also recorded in the history log.
- A “history” panel per task or a global audit log must allow filtering by type of change (dates, comments, cost, effort).

##### 2.7 Roadmap Rendering in Multiple Styles
- The application must provide at least three distinct visualization modes for the same underlying project data:
  - **Gantt chart** (horizontal bar timeline with dependencies).
  - **Timeline/calendar view** (chronological scale, possibly vertical).
  - **Kanban/board view** (columns by status or sprint, cards representing tasks).
- Switching between styles shall not require data re‑entry.
- Each style must support the core features (grouping, milestones, indicative vs. committed) to the extent possible.

##### 2.8 Table Data Input and Dependency Management
- Users must be able to enter and edit all task information in a spreadsheet‑like table view (grid).
- The table must include columns for: task name, category, start date, end date, indicative start, indicative end, duration, assigned person, cost, effort, status, completion %, and predecessor(s).
- Dependencies between tasks (finish‑to‑start, start‑to‑start, etc.) shall be definable directly in the table by referencing task IDs or names.
- On the roadmap, dependencies are shown as arrows/lines connecting the task bars.

#### 3. Non‑Functional Requirements

##### 3.1 Deployment & Delivery
- The application **must** be fully containerized using Docker.
- The AI agent shall provide a `Dockerfile` and, if multiple services are needed, a `docker-compose.yml` file.
- Running the application with a single `docker compose up` command shall start all required services and make the user interface available at `http://localhost` (port 80 or another well‑documented port).
- The container setup must include the back‑end, front‑end, and database components, all pre‑configured and ready to use.

##### 3.2 General Quality Attributes
- The AI‑generated application must be a modern, responsive single‑page web application (using a framework such as React, Vue, or Angular) with a back‑end (e.g., Node.js, Python) and a relational or document database.
- Data must persist reliably inside the containerized environment (e.g., a volume for the database) and support concurrent users (optimistic locking for edits).
- The user interface should be intuitive, with drag‑and‑drop capabilities on timelines and swimlanes.
- The codebase shall be well‑structured, documented, and easily extensible.

#### 4. AI Agent Implementation Instructions
- The AI agent shall take this specification as the primary blueprint and produce a complete, runnable codebase.
- The agent is free to choose the most suitable technology stack, provided all functional and non‑functional requirements are met.
- The output must include:
  - Database schema
  - API endpoints
  - Front‑end components
  - `Dockerfile` and `docker-compose.yml` (if applicable)
  - Clear instructions for local deployment: how to build the image and run the container to access the app on `localhost`.
- The agent should generate sample data that illustrates transactional marts, accounting marts, and non‑transactional marts with indicative and committed timelines, dependencies, and milestones, so the reviewer can immediately verify the features on `http://localhost`.