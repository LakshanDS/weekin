"""End-to-end API test for the report review cycle (run: python tests/api_cycle.py)."""
import json
import urllib.request

BASE = "http://[::1]:3000/api"
PASS = "password123"


def call(method, path, jar=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if jar:
        req.add_header("Cookie", jar)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as res:
            return res.status, res.headers.get("Set-Cookie", ""), json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, "", json.loads(e.read() or b"{}")


def login(email):
    status, set_cookie, _ = call("POST", "/auth/login", body={"email": email, "password": PASS})
    assert status == 200, f"login {email} failed: {status}"
    return set_cookie.split(";")[0]


def check(label, condition, detail=""):
    print(("PASS " if condition else "FAIL ") + label + (f"  {detail}" if detail and not condition else ""))
    assert condition, label


# --- member: create draft ---
alice = login("alice@demo.io")
projects = call("GET", "/projects", jar=alice)[2]["projects"]
pid = projects[0]["id"]

content = {
    "tasks": [{"name": "Build report editor", "priority": "HIGH", "plannedPct": 60, "actualPct": 30,
               "status": "IN_PROGRESS", "timePlannedH": 10, "timeSpentH": 5, "deliverable": "Editor UI"}],
    "nextWeekTasks": ["Polish editor"],
    "blockers": [{"text": "Waiting on API", "isKey": True}],
    "achievements": [],
    "hoursByType": {"development": 12, "meetings": 2},
    "notes": None,
}

# make reruns idempotent: drop leftovers of a previous run (draft/needs-correction only)
listing = call("GET", "/reports?from=2026-09-07&to=2026-09-07", jar=alice)[2]
for stale in listing["reports"]:
    call("DELETE", f"/reports/{stale['id']}", jar=alice)

status, _, body = call("POST", "/reports", jar=alice, body={
    "projectId": pid, "weekStart": "2026-09-07", "weekEnd": "2026-09-11", "content": content})
check("create draft 201", status == 201, body)
rid = body["report"]["id"]
check("draft status", body["report"]["status"] == "DRAFT")

# duplicate week rejected
status, _, _ = call("POST", "/reports", jar=alice, body={
    "projectId": pid, "weekStart": "2026-09-07", "weekEnd": "2026-09-11", "content": content})
check("duplicate week 409", status == 409)

# --- member: edit draft (updates v1 in place), submit ---
status, _, body = call("PUT", f"/reports/{rid}", jar=alice, body={"projectId": pid, "content": content})
check("edit draft 200", status == 200, body)
v1 = call("GET", f"/reports/{rid}/versions", jar=alice)[2]["versions"]
check("draft edit updated v1 in place", len(v1) == 1 and v1[0]["submittedAt"] is None)

status, _, body = call("POST", f"/reports/{rid}/submit", jar=alice)
check("submit 200 -> SUBMITTED", status == 200 and body["status"] == "SUBMITTED", body)

# manager sees the submitted report, member content frozen
mgr = login("manager@demo.io")
detail = call("GET", f"/reports/{rid}", jar=mgr)[2]
check("manager sees submitted content", detail["content"]["versionNo"] == 1 and not detail["content"]["isDraftContent"])

# --- RBAC ---
bob = login("bob@demo.io")
status, _, _ = call("GET", f"/reports/{rid}", jar=bob)
check("other member gets 404", status == 404)
status, _, _ = call("POST", f"/reports/{rid}/approve", jar=alice, body={})
check("member cannot approve (403)", status == 403)
status, _, body = call("GET", "/reports?userId=14", jar=bob)
check("member userId filter ignored (own rows only)", all(r["userId"] != 14 for r in body["reports"]))
status, _, body = call("PUT", f"/reports/{rid}", jar=mgr, body={"projectId": pid, "content": content})
check("manager cannot edit content (403)", status == 403)

# --- manager: request changes (comment tied to v1) ---
status, _, body = call("POST", f"/reports/{rid}/request-changes", jar=mgr,
                       body={"comment": "Add actual percentages for the task."})
check("request changes -> NEEDS_CORRECTION", status == 200 and body["status"] == "NEEDS_CORRECTION", body)

detail = call("GET", f"/reports/{rid}", jar=alice)[2]
check("member sees manager comment", any(c["action"] == "REQUEST_CHANGES" for c in detail["comments"]))
check("comment tied to version 1", detail["comments"][0]["versionNo"] == 1)

# --- member: edit (creates v2), resubmit ---
content2 = dict(content, tasks=[dict(content["tasks"][0], actualPct=60, timeSpentH=10)])
status, _, _ = call("PUT", f"/reports/{rid}", jar=alice, body={"projectId": pid, "content": content2})
v = call("GET", f"/reports/{rid}/versions", jar=alice)[2]["versions"]
check("edit after freeze creates v2 (unsubmitted)", len(v) == 2 and v[1]["submittedAt"] is None, v)

status, _, body = call("POST", f"/reports/{rid}/submit", jar=alice)
check("resubmit -> SUBMITTED", status == 200 and body["status"] == "SUBMITTED")

# manager still sees frozen v1 content while v2 is the new review target
detail_mgr = call("GET", f"/reports/{rid}", jar=mgr)[2]
check("manager now sees v2", detail_mgr["content"]["versionNo"] == 2)

# --- manager: approve with comment on v2 ---
status, _, body = call("POST", f"/reports/{rid}/approve", jar=mgr, body={"comment": "Fixed, thanks."})
check("approve -> APPROVED", status == 200 and body["status"] == "APPROVED", body)

# approved reports are locked
status, _, _ = call("PUT", f"/reports/{rid}", jar=alice, body={"projectId": pid, "content": content2})
check("approved report locked (409)", status == 409)

final = call("GET", f"/reports/{rid}", jar=alice)[2]
actions = [(c["action"], c["versionNo"]) for c in final["comments"]]
check("comment history across versions", ("REQUEST_CHANGES", 1) in actions and ("APPROVE", 2) in actions, actions)

# manager list filter: submitted only
queued = call("GET", "/reports?status=SUBMITTED&pageSize=100", jar=mgr)[2]
check("manager review queue filter works", all(r["status"] == "SUBMITTED" for r in queued["reports"]))

print("\nAll cycle checks passed.")
