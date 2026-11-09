# HustleHub+ — SonarQube Cloud Guide

## Member 4 — Code Quality, Security and Bug Fixing

**Project:** HustleHub+  
**Module:** INSY7314 / APDS7311 Part 3 POE  
**Repository:** https://github.com/EMGPSD/insy7314-g3-2026-poe-final-group-12  
**SonarQube Project Key:** `EMGPSD_insy7314-g3-2026-poe-final-group-12`  
**Branch:** `main`

---

## 1. Purpose

SonarQube Cloud was used to evaluate and improve the security, reliability and maintainability of the HustleHub+ source code.

Static analysis helped identify issues in the backend, frontend, Dockerfiles and configuration files.

The objective was to resolve reported problems, verify corrections through testing and maintain a passing Quality Gate.

SonarQube complements automated tests and manual testing. A passing Quality Gate does not guarantee that the entire application is free of defects or vulnerabilities.

---

## 2. SonarQube Results Before Fixes

The initial analysis identified code-quality and security issues that required investigation.

Issues included input validation, backend reliability, frontend code quality and Docker security configuration.

### Figure 1 — Initial SonarQube Overview


- SonarQube project Overview page
- Quality Gate status before corrections
- Number of issues
- Security rating and other available metrics

<img width="940" height="484" alt="image" src="https://github.com/user-attachments/assets/64f0127c-8ab7-49f0-ae29-971beddcea75" />

**Evidence description:** Initial SonarQube project overview before the code-quality corrections.

### Figure 2 — Examples of Identified Issues


- SonarQube Issues page
- Examples of unresolved issues
- Severity and affected files where visible

<img width="940" height="371" alt="image" src="https://github.com/user-attachments/assets/4bd0663c-af0a-424a-91c1-31a54a3d8041" />


**Evidence description:** Examples of issues requiring investigation. This screenshot may represent a different analysis date from Figure 1 and should not be treated as an exact count for that earlier overview.

---

## 3. Code Quality and Security Improvements

The following improvements were implemented and committed separately.

### 3.1 Backend Security

- Improved MongoDB identifier validation.
- Added protection against unsafe query inputs and NoSQL injection patterns.
- Improved email validation.
- Improved financial input handling.
- Updated environment-based DNS configuration.

### 3.2 Backend Reliability

- Improved asynchronous logging and startup handling.
- Added backend liveness and readiness endpoints.
- Added automated tests for health endpoint behavior.

Health endpoints:

- `GET /health/live`
- `GET /health/ready`

The readiness endpoint checks whether MongoDB is connected.

### 3.3 Frontend Quality

- Addressed SonarQube-reported frontend formatting and button issues.
- Verified frontend builds after changes.

### 3.4 Docker Security

Three Docker-related findings were addressed:

**Finding 1: Nginx running as root**

The frontend runtime image was changed to:

`nginxinc/nginx-unprivileged:stable-alpine`

Nginx now listens on port `8080` inside the container.

Runtime verification confirmed that Nginx uses UID 101 rather than root.

**Finding 2: Frontend npm lifecycle scripts**

The frontend Dockerfile was updated to install dependencies using:

`npm ci --ignore-scripts --no-audit --no-fund`

A fresh Docker build completed successfully.

**Finding 3: Backend npm lifecycle scripts**

The backend Dockerfile was updated to use:

`npm ci --omit=dev --ignore-scripts --no-audit --no-fund`

The backend image built successfully, and the application passed its Docker health checks.

---

## 4. Testing and Verification

Corrections were verified using relevant automated tests, Docker builds, health checks and API requests.

At the health endpoint implementation milestone, the backend test suite reported:

- Tests passed: 256
- Tests failed: 0
- Test suites: 21

These results represent the recorded execution at that milestone, not necessarily the final test count for later commits.

### Figure 3 — Automated Test Results


- Terminal showing the backend test command
- Total tests passed
- Total tests failed
- Test suites completed

<img width="1097" height="485" alt="image" src="https://github.com/user-attachments/assets/235d1926-28ae-4e57-a9bb-a88f691a810d" />
>Frontend Tests
<br>
<img width="1115" height="635" alt="image" src="https://github.com/user-attachments/assets/60fafeb5-e679-48b9-9357-1bd72a2d525b" />
>Backend Tests

### Figure 4 — Docker Security Verification


- Terminal showing `docker compose ps`
- All three services healthy
- Optional second screenshot showing `id` returning UID 101 for Nginx

<img width="1423" height="329" alt="image" src="https://github.com/user-attachments/assets/a5dacbe1-a4f7-4c5a-ad05-b21a1ecc3761" />


---

## 5. SonarQube Results After Fixes

Following the corrections, the SonarQube Cloud project dashboard reported:

| Metric | Recorded result |
|---|---|
| Quality Gate | Passed |
| Reported issues | 0 |
| Security rating | A |
| Code duplication | 1.7% |
| Security issues shown | 0 |
| Security issues closed in the previous 30 days | 9 |
| Code coverage | No data displayed |

These values were observed in the SonarQube screenshots captured on 9 November 2026.

The Quality Gate result should be checked again against the final submitted commit.

### Figure 5 — SonarQube Overview After Fixes


- Quality Gate marked Passed
- Zero issues
- Security rating A
- Code duplication percentage

<img width="940" height="489" alt="image" src="https://github.com/user-attachments/assets/a8d6da3d-2867-4c1d-b0ad-db63f664577f" />


### Figure 6 — Zero Remaining Issues


- SonarQube Issues page
- Branch `main`
- Zero reported issues
- No issues message

<img width="940" height="489" alt="image" src="https://github.com/user-attachments/assets/e29fdfc7-e08a-4007-8493-d396de2f94f8" />


---

## 6. How Team Members Access SonarQube

Every team member should review SonarQube after pushing their changes.

### Step 1 — Sign In

1. Visit https://sonarcloud.io.
2. Sign in using the GitHub account with access to the project.
3. Open the HustleHub+ project.
4. Select the correct branch.

### Step 2 — Check the Latest Analysis

1. Open the project's Analysis or Overview page.
2. Check when the latest analysis completed.
3. Verify that the analysis corresponds to the relevant GitHub commit.
4. If the latest commit has not been analyzed, wait for the analysis to complete.

A successful GitHub push does not necessarily mean that SonarQube has completed its analysis.

### Figure 7 — Project Overview Navigation


- SonarQube sidebar
- Selected project
- Overview and Analysis navigation
- Latest analysis information

<img width="940" height="484" alt="image" src="https://github.com/user-attachments/assets/dc6699e7-046d-483d-a174-665554f2f990" />


---

## 7. Finding Issues After Each Commit

1. Open **Analysis then Issues**.
2. Select the relevant branch.
3. Review the issues listed.
4. Use filters for severity, status and affected files.
5. Open an issue to identify its file, line number and explanation.
6. Determine whether the issue was introduced by the latest change or already existed.

---

## 8. Fixing and Verifying Issues

For each issue:

1. Understand the reported problem.
2. Identify the affected source file.
3. Implement an appropriate correction.
4. Run the relevant automated tests.
5. Build and test the affected application component.
6. Commit the correction with a descriptive message.
7. Push the change.
8. Wait for SonarQube to analyze the new commit.
9. Confirm whether the issue is resolved and the Quality Gate passes.

Do not automatically accept every suggested correction without checking its effect on application behavior.

Members should coordinate before modifying files owned by another team member.

---

## 9. GitHub Commit Evidence

Each important correction should be traceable to a GitHub commit.

Examples of Member 4 commits during SonarQube fixes:

| Commit | Description |
|---|---|
| `7d80521` | MongoDB ID validation and NoSQL injection protection |
| `32c7d94` | Asynchronous logging and startup reliability |
| `0ec21fe` | Email validation and financial input handling |
| `0981a64` | Frontend quality corrections |
| `52a18af` | Environment DNS configuration |
| `b594f42` | Backend liveness and readiness endpoints |
| `b167d7c` | Docker Compose health checks |
| `82719b8` | Non-root Nginx configuration |
| `5022428` | Backend npm installation security |

This is a selection of relevant commits, not a complete repository history.

<img width="1269" height="833" alt="image" src="https://github.com/user-attachments/assets/1dcbc9c8-332a-4a80-8709-714524255b75" />

---

## 10. Team Checks Before Submission

The team should continue checking SonarQube after future changes to avoid reintroducing previously resolved issues. Preferably after completing their member work
