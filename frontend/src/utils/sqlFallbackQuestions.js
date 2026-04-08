const buildSqlQuestion = ({
  id,
  title,
  slug,
  difficulty,
  tags,
  short_description,
  problem_statement,
  sql_schema,
  input_format,
  output_format,
  expected_output,
  sample_tables,
  constraints,
  example_input,
  example_output,
  example_explanation,
  starter_code,
  solutions,
}) => ({
  id,
  title,
  slug,
  difficulty,
  category: "sql",
  tags,
  problem_statement,
  short_description,
  diagram_url: null,
  diagram_caption: null,
  input_format,
  output_format,
  sql_schema,
  expected_output,
  sample_tables,
  function_signature: null,
  constraints,
  time_limit: 1,
  memory_limit: 256,
  points: difficulty === "easy" ? 10 : 20,
  visibility: "published",
  created_by: 1,
  created_at: "2026-04-04T00:00:00",
  updated_at: "2026-04-04T00:00:00",
  examples: [
    {
      id: id * 10 + 1,
      input: example_input,
      output: example_output,
      explanation: example_explanation,
    },
  ],
  test_cases: [],
  starter_codes: [
    {
      id: id * 10 + 2,
      language: "sql",
      code: starter_code,
    },
  ],
  solutions: solutions.map((solution, index) => ({
    id: id * 100 + index + 1,
    language: "sql",
    code: solution.code,
    explanation: solution.explanation,
    approach_type: solution.approach_type,
  })),
});

const SQL_SAMPLE_TABLES = {
  101: [{ name: "Employee", columns: ["id", "name", "salary"], rows: [["1", "Asha", "100"], ["2", "Rahul", "300"], ["3", "Mina", "200"]] }],
  102: [
    { name: "Employee", columns: ["id", "name", "salary", "departmentId"], rows: [["1", "Asha", "90000", "1"], ["2", "Ravi", "85000", "1"], ["3", "Mina", "75000", "2"]] },
    { name: "Department", columns: ["id", "name"], rows: [["1", "IT"], ["2", "HR"]] },
  ],
  103: [
    { name: "Customers", columns: ["id", "name"], rows: [["1", "Asha"], ["2", "Ravi"], ["3", "Mina"]] },
    { name: "Orders", columns: ["id", "customerId"], rows: [["11", "1"], ["12", "3"]] },
  ],
  104: [{ name: "Person", columns: ["id", "email"], rows: [["1", "admin@example.com"], ["2", "team@example.com"], ["3", "admin@example.com"]] }],
  105: [{ name: "Weather", columns: ["id", "recordDate", "temperature"], rows: [["1", "2026-04-01", "20"], ["2", "2026-04-02", "23"], ["3", "2026-04-03", "19"], ["4", "2026-04-04", "22"]] }],
  106: [
    { name: "Product", columns: ["product_id", "product_name", "price"], rows: [["1", "Laptop", "60000"], ["2", "Mouse", "500"]] },
    { name: "Sales", columns: ["sale_id", "product_id", "units"], rows: [["1", "1", "2"], ["2", "2", "10"]] },
  ],
  107: [{ name: "Transactions", columns: ["id", "trans_date", "amount", "state"], rows: [["1", "2026-01-02", "120.00", "approved"], ["2", "2026-01-09", "300.00", "approved"], ["3", "2026-01-18", "200.00", "declined"], ["4", "2026-01-22", "300.00", "approved"]] }],
  108: [{ name: "Employee", columns: ["id", "name", "department", "managerId"], rows: [["1", "Sonia", "Engineering", "NULL"], ["2", "Asha", "Engineering", "1"], ["3", "Ravi", "Engineering", "1"], ["4", "Mina", "Engineering", "1"], ["5", "Kiran", "Engineering", "1"], ["6", "Devi", "Engineering", "1"]] }],
  109: [
    { name: "Customers", columns: ["id", "name"], rows: [["1", "Asha"], ["2", "Ravi"], ["3", "Mina"]] },
    { name: "Orders", columns: ["id", "customer_id", "order_date"], rows: [["1", "1", "2026-03-01"], ["2", "1", "2026-03-06"], ["3", "2", "2026-03-07"]] },
  ],
  110: [{ name: "Employee", columns: ["id", "name", "salary", "managerId"], rows: [["1", "Asha", "70000", "NULL"], ["2", "Ritu", "82000", "1"], ["3", "Manoj", "65000", "1"]] }],
  111: [{ name: "Activity", columns: ["user_id", "session_id", "activity_date", "activity_type"], rows: [["1", "10", "2026-04-01", "login"], ["1", "11", "2026-04-01", "purchase"], ["2", "20", "2026-04-01", "login"], ["3", "30", "2026-04-02", "login"]] }],
};

export const SQL_FALLBACK_QUESTIONS = {
  101: buildSqlQuestion({
    id: 101,
    title: "Second Highest Salary",
    slug: "sql-second-highest-salary",
    difficulty: "easy",
    tags: ["sql", "subquery", "salary"],
    short_description: "Return the second highest distinct salary from the employee table.",
    problem_statement:
      "Write an SQL query to return the second highest distinct salary from the Employee table.\nIf there is no second highest distinct salary, return NULL.\nUse only distinct salary values when deciding rank.\nThe output must expose one column named SecondHighestSalary.\nThink carefully about duplicate salary values.\nThis problem is a good introduction to ranking without window functions.\nYou can solve it with a subquery or with sorting and offset.\nYour query should still work when the table contains only one distinct salary.\nDo not hardcode any salary value.\nReturn exactly one row in the required format.",
    sql_schema: "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- salary INT",
    input_format: "Use the Employee table shown in the schema section.",
    output_format: "Return one column named SecondHighestSalary.",
    expected_output: "SecondHighestSalary\n200",
    sample_tables: SQL_SAMPLE_TABLES[101],
    constraints: "Salaries may repeat. Use distinct salary values when deciding the second highest salary.",
    example_input: "Employee\n(1, 'Asha', 100)\n(2, 'Rahul', 300)\n(3, 'Mina', 200)",
    example_output: "SecondHighestSalary\n200",
    example_explanation: "The highest distinct salary is 300 and the second highest is 200.",
    starter_code: "SELECT NULL AS SecondHighestSalary;",
    solutions: [
      {
        code: "SELECT MAX(salary) AS SecondHighestSalary\nFROM Employee\nWHERE salary < (SELECT MAX(salary) FROM Employee);",
        explanation: "Find the maximum salary below the overall maximum.",
        approach_type: "optimized",
      },
      {
        code: "SELECT DISTINCT salary AS SecondHighestSalary\nFROM Employee\nORDER BY salary DESC\nLIMIT 1 OFFSET 1;",
        explanation: "Sort distinct salaries and pick the second row.",
        approach_type: "brute_force",
      },
    ],
  }),
  102: buildSqlQuestion({
    id: 102,
    title: "Department Highest Salary",
    slug: "sql-department-highest-salary",
    difficulty: "medium",
    tags: ["sql", "join", "group-by"],
    short_description: "List the highest paid employee in each department.",
    problem_statement:
      "Write an SQL query to find employees who have the highest salary in each department.\nReturn the department name, employee name, and salary.\nIf multiple employees tie for the highest salary, include all of them.\nYou will need to combine employee and department information.\nThis problem tests joins plus grouped aggregation.\nThe query should work for any number of departments.\nAvoid hardcoding department names.\nBe careful to match the department maximum salary correctly.\nOutput columns must be Department, Employee, and Salary.\nReturn all valid top earners.",
    sql_schema: "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- salary INT\n- departmentId INT\n\nTable: Department\n- id INT PRIMARY KEY\n- name VARCHAR(100)",
    input_format: "Use Employee and Department.",
    output_format: "Return columns Department, Employee, Salary.",
    expected_output: "Department | Employee | Salary\nIT | Asha | 90000\nHR | Mina | 75000",
    sample_tables: SQL_SAMPLE_TABLES[102],
    constraints: "Return all employees tied for the highest salary in a department.",
    example_input: "Employee rows joined with Department rows as described in the schema.",
    example_output: "Department | Employee | Salary\nIT | Asha | 90000",
    example_explanation: "Asha has the top salary inside the IT department.",
    starter_code: "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON d.id = e.departmentId;",
    solutions: [
      {
        code: "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON d.id = e.departmentId\nJOIN (\n    SELECT departmentId, MAX(salary) AS max_salary\n    FROM Employee\n    GROUP BY departmentId\n) m ON m.departmentId = e.departmentId AND m.max_salary = e.salary;",
        explanation: "Find each department's max salary, then join matching employees.",
        approach_type: "optimized",
      },
      {
        code: "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON d.id = e.departmentId\nWHERE e.salary = (\n    SELECT MAX(e2.salary)\n    FROM Employee e2\n    WHERE e2.departmentId = e.departmentId\n);",
        explanation: "Use a correlated subquery per employee row.",
        approach_type: "brute_force",
      },
    ],
  }),
  103: buildSqlQuestion({
    id: 103,
    title: "Customers Who Never Order",
    slug: "sql-customers-who-never-order",
    difficulty: "easy",
    tags: ["sql", "left-join", "null"],
    short_description: "Find customers who do not appear in the Orders table.",
    problem_statement:
      "Write an SQL query to report all customers who never placed an order.\nThe output should contain one column named Customers.\nYou need to compare the customer table with the order table.\nEvery customer without a matching order must appear exactly once.\nThis is a classic left join and NULL filtering problem.\nA NOT IN solution can also work if null handling is safe.\nDo not return customers who have any order.\nKeep the output simple and clean.\nUse the provided schema names directly.\nReturn every customer with zero orders.",
    sql_schema: "Table: Customers\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n\nTable: Orders\n- id INT PRIMARY KEY\n- customerId INT",
    input_format: "Use Customers and Orders.",
    output_format: "Return one column named Customers.",
    expected_output: "Customers\nRavi",
    sample_tables: SQL_SAMPLE_TABLES[103],
    constraints: "Each order belongs to one customer. A customer with zero orders must appear once.",
    example_input: "Customers with one name missing from the Orders table.",
    example_output: "Customers\nRavi",
    example_explanation: "Ravi has no matching row in Orders.",
    starter_code: "SELECT c.name AS Customers\nFROM Customers c;",
    solutions: [
      {
        code: "SELECT c.name AS Customers\nFROM Customers c\nLEFT JOIN Orders o ON o.customerId = c.id\nWHERE o.id IS NULL;",
        explanation: "Keep all customers and filter those without matches.",
        approach_type: "optimized",
      },
      {
        code: "SELECT name AS Customers\nFROM Customers\nWHERE id NOT IN (SELECT customerId FROM Orders);",
        explanation: "Exclude any customer id present in Orders.",
        approach_type: "brute_force",
      },
    ],
  }),
  104: buildSqlQuestion({
    id: 104,
    title: "Duplicate Emails",
    slug: "sql-duplicate-emails",
    difficulty: "easy",
    tags: ["sql", "group-by", "having"],
    short_description: "Return email values that appear more than once.",
    problem_statement:
      "Write an SQL query to find all duplicate email addresses.\nReturn each duplicated email only once.\nThis problem is based on counting repeated values.\nUse one output column named Email.\nA grouped aggregation solution is the most direct.\nA self-join solution is also possible.\nDo not include emails that appear only once.\nThe input table may contain many unique and repeated values.\nYour output order is not important unless specified.\nReturn the repeated addresses clearly.",
    sql_schema: "Table: Person\n- id INT PRIMARY KEY\n- email VARCHAR(255)",
    input_format: "Use the Person table.",
    output_format: "Return one column named Email.",
    expected_output: "Email\nadmin@example.com",
    sample_tables: SQL_SAMPLE_TABLES[104],
    constraints: "Return each duplicate email only once.",
    example_input: "Person rows with repeated email values.",
    example_output: "Email\nadmin@example.com",
    example_explanation: "The email appears in more than one row.",
    starter_code: "SELECT email AS Email\nFROM Person;",
    solutions: [
      {
        code: "SELECT email AS Email\nFROM Person\nGROUP BY email\nHAVING COUNT(*) > 1;",
        explanation: "Count rows per email and keep groups greater than one.",
        approach_type: "optimized",
      },
      {
        code: "SELECT DISTINCT p1.email AS Email\nFROM Person p1\nJOIN Person p2 ON p1.email = p2.email AND p1.id <> p2.id;",
        explanation: "Self-join equal emails from different rows.",
        approach_type: "brute_force",
      },
    ],
  }),
  105: buildSqlQuestion({
    id: 105,
    title: "Rising Temperature",
    slug: "sql-rising-temperature",
    difficulty: "medium",
    tags: ["sql", "date", "self-join"],
    short_description: "Find dates where the temperature is higher than the previous day.",
    problem_statement:
      "Write an SQL query to find all dates where the temperature was higher than the previous day.\nReturn the row id for every such date.\nYou must compare only with the immediate previous calendar day.\nThis problem combines date logic with joining or correlated lookup.\nDo not compare with non-adjacent dates.\nThe output column must be named Id.\nMissing previous dates should not produce results.\nYou can solve this with a self-join or a correlated subquery.\nBe careful with date arithmetic syntax in SQL.\nReturn every valid id that satisfies the rule.",
    sql_schema: "Table: Weather\n- id INT PRIMARY KEY\n- recordDate DATE\n- temperature INT",
    input_format: "Use the Weather table.",
    output_format: "Return one column named Id.",
    expected_output: "Id\n2\n4",
    sample_tables: SQL_SAMPLE_TABLES[105],
    constraints: "Compare only with the immediate previous calendar day.",
    example_input: "Weather rows over consecutive dates.",
    example_output: "Id\n2",
    example_explanation: "The second day has a higher temperature than the first day.",
    starter_code: "SELECT w.id AS Id\nFROM Weather w;",
    solutions: [
      {
        code: "SELECT w1.id AS Id\nFROM Weather w1\nJOIN Weather w2 ON DATEDIFF(w1.recordDate, w2.recordDate) = 1\nWHERE w1.temperature > w2.temperature;",
        explanation: "Join each row to the immediate previous day and compare temperatures.",
        approach_type: "optimized",
      },
      {
        code: "SELECT id AS Id\nFROM Weather w\nWHERE temperature > (\n    SELECT temperature\n    FROM Weather\n    WHERE recordDate = DATE_SUB(w.recordDate, INTERVAL 1 DAY)\n);",
        explanation: "Fetch the previous day's temperature with a subquery.",
        approach_type: "brute_force",
      },
    ],
  }),
  106: buildSqlQuestion({
    id: 106,
    title: "Product Sales Analysis",
    slug: "sql-product-sales-analysis",
    difficulty: "medium",
    tags: ["sql", "join", "aggregation"],
    short_description: "Report total revenue by product.",
    problem_statement:
      "Write an SQL query to calculate total revenue for each product based on units sold and unit price.\nJoin the product metadata with the sales fact table.\nRevenue should be computed as price multiplied by units.\nThen aggregate that total per product.\nReturn product_name and revenue in the result.\nThis problem checks your join and aggregation fundamentals.\nProducts with sales should show their combined revenue.\nBe careful to group by the correct keys.\nAvoid duplicating rows by joining incorrectly.\nReturn one row per product.",
    sql_schema: "Table: Product\n- product_id INT PRIMARY KEY\n- product_name VARCHAR(100)\n- price INT\n\nTable: Sales\n- sale_id INT PRIMARY KEY\n- product_id INT\n- units INT",
    input_format: "Use Product and Sales.",
    output_format: "Return columns product_name and revenue.",
    expected_output: "product_name | revenue\nLaptop | 120000",
    sample_tables: SQL_SAMPLE_TABLES[106],
    constraints: "Revenue is price multiplied by total units sold for that product.",
    example_input: "Sales rows joined to Product pricing.",
    example_output: "product_name | revenue\nLaptop | 120000",
    example_explanation: "Revenue sums all sold units multiplied by price.",
    starter_code: "SELECT p.product_name, 0 AS revenue\nFROM Product p;",
    solutions: [
      {
        code: "SELECT p.product_name, SUM(p.price * s.units) AS revenue\nFROM Product p\nJOIN Sales s ON s.product_id = p.product_id\nGROUP BY p.product_id, p.product_name;",
        explanation: "Multiply price and units, then sum by product.",
        approach_type: "optimized",
      },
      {
        code: "SELECT p.product_name,\n       (SELECT SUM(p.price * s.units)\n        FROM Sales s\n        WHERE s.product_id = p.product_id) AS revenue\nFROM Product p;",
        explanation: "Use a correlated aggregate query per product.",
        approach_type: "brute_force",
      },
    ],
  }),
  107: buildSqlQuestion({
    id: 107,
    title: "Monthly Transaction Totals",
    slug: "sql-monthly-transaction-totals",
    difficulty: "medium",
    tags: ["sql", "group-by", "date"],
    short_description: "Summarize transaction volume and amount by month.",
    problem_statement:
      "Write an SQL query to return the total number of transactions and the total amount for each month.\nGroup dates into YYYY-MM buckets.\nThe result should include month, transaction_count, and total_amount.\nThis is a month-wise reporting problem.\nUse date formatting or a month extraction approach.\nCount all rows in each month bucket.\nSum every amount belonging to the same month.\nSort the final output by month for readability.\nBe careful not to split the same month into multiple groups.\nReturn all months present in the data.",
    sql_schema: "Table: Transactions\n- id INT PRIMARY KEY\n- trans_date DATE\n- amount DECIMAL(10,2)\n- state VARCHAR(20)",
    input_format: "Use the Transactions table.",
    output_format: "Return columns month, transaction_count, total_amount.",
    expected_output: "month | transaction_count | total_amount\n2026-01 | 4 | 920.00",
    sample_tables: SQL_SAMPLE_TABLES[107],
    constraints: "Group all rows by calendar month in YYYY-MM format.",
    example_input: "Transactions recorded across different dates in the same month.",
    example_output: "month | transaction_count | total_amount\n2026-01 | 4 | 920.00",
    example_explanation: "All January transactions are grouped together.",
    starter_code: "SELECT '' AS month, 0 AS transaction_count, 0 AS total_amount;",
    solutions: [
      {
        code: "SELECT DATE_FORMAT(trans_date, '%Y-%m') AS month,\n       COUNT(*) AS transaction_count,\n       SUM(amount) AS total_amount\nFROM Transactions\nGROUP BY DATE_FORMAT(trans_date, '%Y-%m')\nORDER BY month;",
        explanation: "Transform dates into month buckets and aggregate count and sum.",
        approach_type: "optimized",
      },
      {
        code: "SELECT month_bucket.month,\n       COUNT(t.id) AS transaction_count,\n       SUM(t.amount) AS total_amount\nFROM (\n    SELECT DISTINCT DATE_FORMAT(trans_date, '%Y-%m') AS month\n    FROM Transactions\n) month_bucket\nJOIN Transactions t ON DATE_FORMAT(t.trans_date, '%Y-%m') = month_bucket.month\nGROUP BY month_bucket.month\nORDER BY month_bucket.month;",
        explanation: "Build distinct month buckets first, then join transactions into them.",
        approach_type: "brute_force",
      },
    ],
  }),
  108: buildSqlQuestion({
    id: 108,
    title: "Managers With At Least Five Reports",
    slug: "sql-managers-with-five-reports",
    difficulty: "medium",
    tags: ["sql", "self-join", "group-by"],
    short_description: "Find managers who supervise at least five employees.",
    problem_statement:
      "Write an SQL query to report the names of managers who have at least five direct reports.\nCount only employees who directly reference that manager id.\nDo not count indirect hierarchy relationships.\nReturn one column named name.\nThis problem uses a self-join on the employee table.\nYou can also solve it using grouping on managerId and then joining back.\nMake sure the manager name appears only once in the result.\nOnly managers meeting the minimum threshold should appear.\nThis is a strong exercise in self joins and HAVING.\nReturn every qualifying manager.",
    sql_schema: "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- department VARCHAR(100)\n- managerId INT",
    input_format: "Use the Employee table.",
    output_format: "Return one column named name.",
    expected_output: "name\nSonia",
    sample_tables: SQL_SAMPLE_TABLES[108],
    constraints: "Count only direct reports, not indirect hierarchy levels.",
    example_input: "Employee rows where one manager id appears at least five times.",
    example_output: "name\nSonia",
    example_explanation: "Sonia is the manager with five direct reports.",
    starter_code: "SELECT e.name\nFROM Employee e;",
    solutions: [
      {
        code: "SELECT m.name\nFROM Employee m\nJOIN Employee e ON e.managerId = m.id\nGROUP BY m.id, m.name\nHAVING COUNT(*) >= 5;",
        explanation: "Group reports by manager and keep those with count >= 5.",
        approach_type: "optimized",
      },
      {
        code: "SELECT name\nFROM Employee\nWHERE id IN (\n    SELECT managerId\n    FROM Employee\n    GROUP BY managerId\n    HAVING COUNT(*) >= 5\n);",
        explanation: "First identify manager ids with enough reports, then return their names.",
        approach_type: "brute_force",
      },
    ],
  }),
  109: buildSqlQuestion({
    id: 109,
    title: "Top Customer by Orders",
    slug: "sql-top-customer-by-orders",
    difficulty: "easy",
    tags: ["sql", "join", "order-by"],
    short_description: "Find the customer with the most orders.",
    problem_statement:
      "Write an SQL query to find the customer who placed the highest number of orders.\nIf multiple customers tie for the highest count, return all of them.\nJoin the Customers and Orders tables.\nCount orders per customer first.\nThen compare those counts against the maximum count.\nThe output should include customer_name and order_count.\nThis is a ranking-through-aggregation style problem.\nAvoid returning only one row if there is a tie.\nMake sure customers are grouped correctly.\nReturn all top customers.",
    sql_schema: "Table: Customers\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n\nTable: Orders\n- id INT PRIMARY KEY\n- customer_id INT\n- order_date DATE",
    input_format: "Use Customers and Orders.",
    output_format: "Return columns customer_name and order_count.",
    expected_output: "customer_name | order_count\nAsha | 12",
    sample_tables: SQL_SAMPLE_TABLES[109],
    constraints: "If multiple customers tie, return all of them.",
    example_input: "Orders linked to several customers.",
    example_output: "customer_name | order_count\nAsha | 12",
    example_explanation: "Asha placed the greatest number of orders.",
    starter_code: "SELECT c.name AS customer_name, COUNT(o.id) AS order_count\nFROM Customers c\nLEFT JOIN Orders o ON o.customer_id = c.id\nGROUP BY c.id, c.name;",
    solutions: [
      {
        code: "WITH order_counts AS (\n    SELECT c.name AS customer_name, COUNT(o.id) AS order_count\n    FROM Customers c\n    JOIN Orders o ON o.customer_id = c.id\n    GROUP BY c.id, c.name\n)\nSELECT customer_name, order_count\nFROM order_counts\nWHERE order_count = (SELECT MAX(order_count) FROM order_counts);",
        explanation: "Count orders per customer and keep only the maximum count rows.",
        approach_type: "optimized",
      },
      {
        code: "SELECT c.name AS customer_name, COUNT(o.id) AS order_count\nFROM Customers c\nJOIN Orders o ON o.customer_id = c.id\nGROUP BY c.id, c.name\nORDER BY order_count DESC\nLIMIT 1;",
        explanation: "Sort by count descending and take the top row when ties are not a concern.",
        approach_type: "brute_force",
      },
    ],
  }),
  110: buildSqlQuestion({
    id: 110,
    title: "Employees Earning More Than Their Manager",
    slug: "sql-employees-earning-more-than-manager",
    difficulty: "easy",
    tags: ["sql", "self-join", "comparison"],
    short_description: "Find employees whose salary exceeds their manager's salary.",
    problem_statement:
      "Write an SQL query to find employees who earn strictly more than their direct manager.\nReturn the employee name in one column named Employee.\nThis problem is solved with a self join on the employee table.\nEach employee row may reference a manager id.\nCompare the employee salary with the manager salary.\nOnly direct manager relationships matter.\nDo not include employees without a manager.\nThis is a classic self-join comparison problem.\nUse clear aliases to keep the query readable.\nReturn every employee who satisfies the condition.",
    sql_schema: "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- salary INT\n- managerId INT",
    input_format: "Use the Employee table.",
    output_format: "Return one column named Employee.",
    expected_output: "Employee\nRitu",
    sample_tables: SQL_SAMPLE_TABLES[110],
    constraints: "Only compare an employee with their direct manager.",
    example_input: "Employee rows with manager references and salary values.",
    example_output: "Employee\nRitu",
    example_explanation: "Ritu's salary is greater than her manager's salary.",
    starter_code: "SELECT e.name AS Employee\nFROM Employee e;",
    solutions: [
      {
        code: "SELECT e.name AS Employee\nFROM Employee e\nJOIN Employee m ON e.managerId = m.id\nWHERE e.salary > m.salary;",
        explanation: "Self-join employees to their managers and compare salary values.",
        approach_type: "optimized",
      },
      {
        code: "SELECT name AS Employee\nFROM Employee e\nWHERE salary > (\n    SELECT salary\n    FROM Employee m\n    WHERE m.id = e.managerId\n);",
        explanation: "Look up the manager's salary in a correlated subquery.",
        approach_type: "brute_force",
      },
    ],
  }),
  111: buildSqlQuestion({
    id: 111,
    title: "Daily Active Users",
    slug: "sql-daily-active-users",
    difficulty: "medium",
    tags: ["sql", "group-by", "distinct"],
    short_description: "Count distinct users active on each day.",
    problem_statement:
      "Write an SQL query to return the number of distinct active users for each activity date.\nA user with multiple sessions on the same day should count only once.\nReturn two columns: activity_date and active_users.\nThis problem is a daily aggregation query.\nUse COUNT(DISTINCT user_id) for accuracy.\nGroup results by activity date.\nSort the final output by activity_date.\nThis is a practical analytics-style SQL task.\nDo not double-count repeat activity from the same user on the same date.\nReturn one row per date.",
    sql_schema: "Table: Activity\n- user_id INT\n- session_id INT\n- activity_date DATE\n- activity_type VARCHAR(50)",
    input_format: "Use the Activity table.",
    output_format: "Return columns activity_date and active_users.",
    expected_output: "activity_date | active_users\n2026-04-01 | 18",
    sample_tables: SQL_SAMPLE_TABLES[111],
    constraints: "Count each user only once per day even if they have multiple sessions.",
    example_input: "Activity rows with repeated sessions for the same user on one date.",
    example_output: "activity_date | active_users\n2026-04-01 | 18",
    example_explanation: "Distinct users are counted once per day.",
    starter_code: "SELECT activity_date, COUNT(DISTINCT user_id) AS active_users\nFROM Activity\nGROUP BY activity_date;",
    solutions: [
      {
        code: "SELECT activity_date, COUNT(DISTINCT user_id) AS active_users\nFROM Activity\nGROUP BY activity_date\nORDER BY activity_date;",
        explanation: "Group by date and count distinct user ids inside each day.",
        approach_type: "optimized",
      },
      {
        code: "SELECT dates.activity_date,\n       (SELECT COUNT(DISTINCT a.user_id)\n        FROM Activity a\n        WHERE a.activity_date = dates.activity_date) AS active_users\nFROM (SELECT DISTINCT activity_date FROM Activity) dates\nORDER BY dates.activity_date;",
        explanation: "Build the day buckets first, then count users in each bucket.",
        approach_type: "brute_force",
      },
    ],
  }),
};

export const getSqlFallbackQuestionById = (questionId) => SQL_FALLBACK_QUESTIONS[Number(questionId)] || null;

export const getSqlFallbackQuestionByMeta = ({ id, slug, title } = {}) => {
  if (id && SQL_FALLBACK_QUESTIONS[Number(id)]) {
    return SQL_FALLBACK_QUESTIONS[Number(id)];
  }

  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const normalizedTitle = String(title || "").trim().toLowerCase();

  return (
    Object.values(SQL_FALLBACK_QUESTIONS).find((question) => {
      return (
        (normalizedSlug && String(question.slug || "").toLowerCase() === normalizedSlug) ||
        (normalizedTitle && String(question.title || "").toLowerCase() === normalizedTitle)
      );
    }) || null
  );
};

export const mergeSqlQuestionDetails = (question) => {
  if (!question || String(question.category || "").toLowerCase() !== "sql") {
    return question;
  }

  const fallback = getSqlFallbackQuestionByMeta({
    id: question.id,
    slug: question.slug,
    title: question.title,
  });

  if (!fallback) {
    return question;
  }

  return {
    ...fallback,
    ...question,
    sample_tables: (question.sample_tables && question.sample_tables.length > 0) ? question.sample_tables : fallback.sample_tables,
    examples: (question.examples && question.examples.length > 0) ? question.examples : fallback.examples,
    expected_output: question.expected_output || fallback.expected_output,
    sql_schema: question.sql_schema || fallback.sql_schema,
    starter_codes: (question.starter_codes && question.starter_codes.length > 0) ? question.starter_codes : fallback.starter_codes,
    solutions: (question.solutions && question.solutions.length > 0) ? question.solutions : fallback.solutions,
  };
};
