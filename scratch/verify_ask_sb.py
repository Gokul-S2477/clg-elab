import requests
import sys

BASE_URL = "http://localhost:8000/ask-sb"
USER_ID = 1  # Assuming user 1 exists (Student One)

def test_ask_sb():
    print("Testing AskSB API...")
    
    # 1. List projects
    try:
        res = requests.get(f"{BASE_URL}/projects?user_id={USER_ID}")
        print(f"List projects: {res.status_code}")
        projects = res.json()
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        return

    # 2. Create a test project
    title = "Test Project Verify"
    res = requests.post(f"{BASE_URL}/projects", json={
        "user_id": USER_ID,
        "title": title
    })
    print(f"Create project: {res.status_code}")
    if res.status_code != 200:
        print(res.text)
        return
    
    project = res.json()
    project_id = project['id']
    print(f"Created project ID: {project_id}")

    # 3. Test chat (now with user_id fix)
    res = requests.post(f"{BASE_URL}/projects/{project_id}/chat", json={
        "user_id": USER_ID,
        "message": "Hello, this is a test."
    })
    print(f"Chat test: {res.status_code}")
    if res.status_code != 200:
        print(res.text)
    else:
        print("Chat successful!")

    # 4. Delete the test project
    res = requests.delete(f"{BASE_URL}/projects/{project_id}?user_id={USER_ID}")
    print(f"Delete project: {res.status_code}")
    if res.status_code == 200:
        print("Project deleted successfully!")
    else:
        print(f"Delete failed: {res.text}")

if __name__ == "__main__":
    test_ask_sb()
