/*
=========================================
WIZZ Calendar Unit Tests
Simple tests for two functions:

1. taskToEvent()  -> converts a task into a calendar event
2. api()          -> sends an API request

Testing framework: Jest
=========================================
*/


/* -------------------------------
   FUNCTION 1: taskToEvent
   Converts a task object into an event
-------------------------------- */

// to run: npx jest calendar.test.js

function taskToEvent(task) {

  const date = task.deadline ? task.deadline.slice(0,10) : null;

  return {
    id: String(task.id),
    date: date,
    name: task.title,
    time: task.description || "",
    priority: task.priority || 3,
    done: task.status === "done"
  };

}


/* -------------------------------
   FUNCTION 2: api
   Sends a request to the backend
-------------------------------- */

async function api(url) {

  const response = await fetch(url);

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return data;

}


/* -------------------------------
   MOCK OBJECT
   Instead of calling a real server,
   we create a fake fetch function
-------------------------------- */

global.fetch = jest.fn();



/* =================================
   TEST SUITE 1
   Testing taskToEvent()
================================= */

describe("taskToEvent tests", () => {

  test("should convert a task into an event", () => {

    const task = {
      id: 1,
      title: "Study for exam",
      description: "10:00 AM",
      deadline: "2026-03-20T00:00:00Z",
      priority: 4,
      status: "todo"
    };

    const event = taskToEvent(task);

    expect(event.name).toBe("Study for exam");
    expect(event.date).toBe("2026-03-20");
    expect(event.done).toBe(false);

  });


  test("should mark event as done", () => {

    const task = {
      id: 2,
      title: "Submit lab",
      description: "",
      deadline: "2026-03-21T00:00:00Z",
      priority: 3,
      status: "done"
    };

    const event = taskToEvent(task);

    expect(event.done).toBe(true);

  });

});



/* =================================
   TEST SUITE 2
   Testing API function
================================= */

describe("api function tests", () => {

  test("should return data from API", async () => {

    // Fake API response
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "success" })
    });

    const result = await api("/test");

    expect(result.message).toBe("success");

  });


  test("should throw error when request fails", async () => {

    fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({})
    });

    await expect(api("/test")).rejects.toThrow("Request failed");

  });

});