# DevTrail Requirements

DevTrail helps a single owner record, understand, and improve their software engineering practice. Development sessions remain the source of development activity. Public registration, multiple owners, collaboration, and general task management are outside the V2 baseline.

## Preserved V2 baseline under review

The table and business rules below describe the behavior preserved in the V2 baseline. Approval to preserve this baseline covers the snapshot as a whole. Individual product requirements, specifications, and acceptance criteria require explicit human approval through the workflow in the README. [Spec-driven development](../README.md#spec-driven-development)

| Area | Implemented behavior |
| --- | --- |
| Overview and analytics | Date- and project-scoped activity, counts, time trends, streaks, contribution heatmap, breakdowns, recent sessions, milestones, and saved insights |
| Sessions | Manual editing, draft and final states, activity classification, search and filters, Markdown and code blocks, references, attachments, and GitHub links |
| Projects and timeline | Project status and stack, journey review, chronological events, date and event filters, contextual details, and milestone progress |
| Learning, challenges, and roadmap | Session-based practice history, learning goals and self-assessment, reusable technical challenges, and milestone completion criteria |
| Insights and reflection | Manually written observations, retrospectives, engineering questions, personal answers, and review notes with optional links to related sessions |
| Reports and tools | Manually written reports or editable summaries from stored records, Markdown export, browser Print/Save as PDF, GitHub sync, grouped search, and workspace settings |

<a name="business-rules"></a>

## Baseline business rules

- Projects have case-insensitively unique names. Their statuses are Planned, Active, On Hold, Completed, and Archived.
- Every session belongs to an existing project. The date can be today or earlier in `Europe/Istanbul`. Multiple sessions can share a date.
- Final sessions require a nonblank summary. Drafts allow incomplete details and are excluded from session analytics and report activity totals.
- Duration is optional and measures recorded activity. Learning evidence and self-assessed understanding are recorded separately.
- Milestone progress counts expressly completed milestones and completion criteria recorded by the owner. Challenge records can link to multiple sessions.
- GitHub connections are one per project and one per repository. Imported activity retains its source identity and can be linked to sessions in that project.
- Projects with development sessions, milestones, or challenges are protected from deletion. Destructive workspace actions require confirmation in the interface.

## Approved domain model

The original MVP model included a project with a name, optional description, and creation and update timestamps. A development session included a project, date, work summary, optional focus, learning notes, difficulties and next steps, and creation and update timestamps. V2 extends those records with the fields described in the API contract.

[API contracts](API.md) · [Release verification and limitations](ROADMAP.md)
