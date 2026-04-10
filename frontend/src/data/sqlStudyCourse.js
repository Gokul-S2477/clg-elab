import rawDocumentRows from "./sqlStudyDocument.json";

const cleanText = (value = "") => value.replace(/\s+/g, " ").trim();
const stripLeadSymbols = (value = "") => cleanText(value).replace(/^[^A-Za-z0-9]+/u, "");
const slugify = (value = "") =>
  stripLeadSymbols(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const topic = (id, title, subtopics = []) => ({ id, title, subtopics });
const moduleDef = (number, title, topics) => ({
  id: `module-${number}`,
  number,
  title,
  topics,
});

const documentLines = rawDocumentRows
  .map((row) => cleanText(row?.text || ""))
  .filter(Boolean);

const COURSE_INTRO_MARKER = (line) => /^1\.\s*SQL INTRODUCTION/i.test(stripLeadSymbols(line));

const MODULE_DETAIL_MARKERS = {
  1: (line) => /^1\.\s*SQL INTRODUCTION/i.test(stripLeadSymbols(line)),
  2: (line) => /MODULE 2 .*ALTER TABLE/i.test(stripLeadSymbols(line)),
  3: (line) => /MODULE 3 .*INSERT/i.test(stripLeadSymbols(line)),
  4: (line) => /MODULE 4 .*SQL SELECT/i.test(stripLeadSymbols(line)),
  5: (line) => /MODULE 5: FILTERING/i.test(stripLeadSymbols(line)),
  6: (line) => /MODULE 6: SQL FUNCTIONS/i.test(stripLeadSymbols(line)),
  7: (line) => /MODULE 7: SQL JOINS/i.test(stripLeadSymbols(line)),
  8: (line) => /MODULE 8 .*GROUP/i.test(stripLeadSymbols(line)),
  9: (line) => /MODULE 9: SUBQUERIES/i.test(stripLeadSymbols(line)),
  10: (line) => /MODULE 10: ADVANCED SQL/i.test(stripLeadSymbols(line)),
  11: (line) => /MODULE 11: PERFORMANCE/i.test(stripLeadSymbols(line)),
  12: (line) => /MODULE 12: REAL-WORLD SQL/i.test(stripLeadSymbols(line)),
  13: (line) => /MODULE 13: DATABASE DESIGN/i.test(stripLeadSymbols(line)),
  14: (line) => /MODULE 14: TRANSACTIONS/i.test(stripLeadSymbols(line)),
  15: (line) => /MODULE 15: ADVANCED SYSTEM DESIGN/i.test(stripLeadSymbols(line)),
  16: (line) => /MODULE 16: INTERVIEW/i.test(stripLeadSymbols(line)),
};

const DETAIL_STARTS = Object.entries(MODULE_DETAIL_MARKERS)
  .map(([number, matcher]) => ({
    number: Number(number),
    index: documentLines.findIndex((line) => matcher(line)),
  }))
  .filter((item) => item.index >= 0)
  .sort((left, right) => left.number - right.number);

const getModuleReferenceLines = (moduleNumber) => {
  const current = DETAIL_STARTS.find((item) => item.number === moduleNumber);
  if (!current) return [];
  const next = DETAIL_STARTS.find((item) => item.number === moduleNumber + 1);
  return documentLines.slice(current.index, next ? next.index : documentLines.length);
};

const OUTLINE_MODULES = [
  moduleDef(1, "SQL Basics (Foundation)", [
    topic("sql-introduction", "SQL Introduction"),
    topic("database-rdbms", "What is Database & RDBMS"),
    topic("sql-syntax", "SQL Syntax"),
    topic("sql-statements-overview", "SQL Statements Overview"),
    topic("sql-data-types", "SQL Data Types"),
    topic("sql-comments", "SQL Comments"),
    topic("sql-keywords-case-sensitivity", "SQL Keywords & Case Sensitivity"),
    topic("sql-naming-conventions", "SQL Naming Conventions"),
  ]),
  moduleDef(2, "Database & Table Operations (DDL)", [
    topic("create-database", "CREATE DATABASE"),
    topic("drop-database", "DROP DATABASE"),
    topic("create-table", "CREATE TABLE"),
    topic("alter-table", "ALTER TABLE"),
    topic("drop-table", "DROP TABLE"),
    topic("truncate-table", "TRUNCATE TABLE"),
    topic("constraints", "Constraints", ["PRIMARY KEY", "FOREIGN KEY", "UNIQUE", "NOT NULL", "CHECK", "DEFAULT"]),
  ]),
  moduleDef(3, "Data Manipulation (DML)", [
    topic("insert", "INSERT"),
    topic("update", "UPDATE"),
    topic("delete", "DELETE"),
    topic("merge-upsert", "MERGE (UPSERT concept)"),
  ]),
  moduleDef(4, "Data Retrieval (Core SQL)", [
    topic("select-full-deep-dive", "SELECT (FULL DEEP DIVE)"),
    topic("from", "FROM"),
    topic("where", "WHERE"),
    topic("distinct", "DISTINCT"),
    topic("order-by", "ORDER BY"),
    topic("limit-top", "LIMIT / TOP"),
  ]),
  moduleDef(5, "Filtering & Conditions", [
    topic("and-or-not", "AND, OR, NOT"),
    topic("in-operator", "IN"),
    topic("between", "BETWEEN"),
    topic("like-pattern-matching", "LIKE (Pattern Matching)"),
    topic("is-null", "IS NULL / IS NOT NULL"),
  ]),
  moduleDef(6, "Functions", [
    topic("aggregate-functions", "Aggregate Functions", ["COUNT", "SUM", "AVG", "MIN", "MAX"]),
    topic("string-functions", "String Functions"),
    topic("date-functions", "Date Functions"),
    topic("numeric-functions", "Numeric Functions"),
    topic("null-functions", "NULL Functions (COALESCE, IFNULL)"),
  ]),
  moduleDef(7, "Joins (Very Important)", [
    topic("inner-join", "INNER JOIN"),
    topic("left-join", "LEFT JOIN"),
    topic("right-join", "RIGHT JOIN"),
    topic("full-join", "FULL JOIN"),
    topic("cross-join", "CROSS JOIN"),
    topic("self-join", "SELF JOIN"),
    topic("join-vs-where", "JOIN vs WHERE"),
    topic("join-internals", "JOIN Internals (Hash / Nested Loop / Merge)"),
  ]),
  moduleDef(8, "Grouping & Aggregation", [
    topic("group-by", "GROUP BY"),
    topic("having", "HAVING"),
    topic("group-by-internals", "GROUP BY Internals"),
    topic("group-by-vs-distinct", "GROUP BY vs DISTINCT"),
    topic("advanced-grouping", "Advanced GROUPING", ["ROLLUP", "CUBE"]),
  ]),
  moduleDef(9, "Subqueries", [
    topic("scalar-subquery", "Scalar Subquery"),
    topic("multiple-row-subquery", "Multiple Row Subquery"),
    topic("correlated-subquery", "Correlated Subquery"),
    topic("subquery-placements", "Subquery in SELECT / FROM / WHERE"),
    topic("exists-vs-in", "EXISTS vs IN"),
    topic("not-in-vs-not-exists", "NOT IN vs NOT EXISTS"),
  ]),
  moduleDef(10, "Advanced SQL", [
    topic("case-statements", "CASE Statements"),
    topic("window-functions", "Window Functions", ["ROW_NUMBER", "RANK", "DENSE_RANK", "LAG / LEAD", "Running Total"]),
    topic("common-table-expressions", "Common Table Expressions (CTE)"),
    topic("recursive-cte", "Recursive CTE"),
  ]),
  moduleDef(11, "Performance & Optimization", [
    topic("indexes", "Indexes (B-Tree, Hash)"),
    topic("query-optimization", "Query Optimization"),
    topic("execution-plan", "Execution Plan (EXPLAIN)"),
    topic("sargable-queries", "SARGABLE Queries"),
    topic("predicate-pushdown", "Predicate Pushdown"),
    topic("partitioning", "Partitioning"),
  ]),
  moduleDef(12, "Real-World SQL", [
    topic("data-cleaning-queries", "Data Cleaning Queries"),
    topic("reporting-queries", "Reporting Queries"),
    topic("analytics-queries", "Analytics Queries"),
    topic("business-kpis", "Business KPIs using SQL"),
    topic("etl-concepts", "ETL Concepts in SQL"),
  ]),
  moduleDef(13, "Database Design", [
    topic("normalization", "Normalization (1NF, 2NF, 3NF)"),
    topic("denormalization", "Denormalization"),
    topic("keys", "Keys (Primary, Foreign, Composite)"),
    topic("relationships", "Relationships"),
  ]),
  moduleDef(14, "Transactions & Control", [
    topic("transactions-acid", "Transactions (ACID)"),
    topic("commit", "COMMIT"),
    topic("rollback", "ROLLBACK"),
    topic("savepoint", "SAVEPOINT"),
    topic("locks-concurrency", "Locks & Concurrency"),
  ]),
  moduleDef(15, "Advanced System Design (Optional For eLab)", [
    topic("data-warehousing-basics", "Data Warehousing Basics"),
    topic("oltp-vs-olap", "OLTP vs OLAP"),
    topic("star-snowflake-schema", "Star Schema / Snowflake Schema"),
    topic("materialized-views", "Materialized Views"),
  ]),
  moduleDef(16, "Interview + Edge Cases", [
    topic("sql-tricky-questions", "SQL Tricky Questions"),
    topic("performance-scenarios", "Performance Scenarios"),
    topic("real-company-problems", "Real Company Problems"),
    topic("query-debugging", "Query Debugging"),
  ]),
];

const allTopics = OUTLINE_MODULES.flatMap((module) =>
  module.topics.map((moduleTopic, index) => ({
    ...moduleTopic,
    moduleId: module.id,
    moduleNumber: module.number,
    moduleTitle: module.title,
    topicNumber: index + 1,
    absoluteTopicNumber:
      OUTLINE_MODULES.slice(0, module.number - 1).reduce((sum, item) => sum + item.topics.length, 0) + index + 1,
  }))
);

const moduleReferenceMap = Object.fromEntries(
  OUTLINE_MODULES.map((module) => [module.id, getModuleReferenceLines(module.number)])
);

const courseIntroLines = (() => {
  const startIndex = documentLines.findIndex((line) => COURSE_INTRO_MARKER(line));
  return startIndex > 0 ? documentLines.slice(0, startIndex) : documentLines.slice(0, 120);
})();

const exampleBlock = (title, description, sql) => ({ title, description, sql });

const buildExamples = (title, moduleTitle) => {
  const normalized = title.toLowerCase();

  if (normalized === "case statements") {
    return [
      exampleBlock(
        "Salary Band Example",
        "This query classifies each employee into a salary band. It is the most common beginner-friendly CASE use because students can clearly see one input column turning into a readable label.",
        "SELECT employee_name,\n       salary,\n       CASE\n         WHEN salary >= 100000 THEN 'High'\n         WHEN salary >= 60000 THEN 'Medium'\n         ELSE 'Entry'\n       END AS salary_band\nFROM employees;"
      ),
      exampleBlock(
        "Result Status Example",
        "This CASE expression converts marks into pass or fail output so the result table becomes easier for business users or faculty to read.",
        "SELECT student_name,\n       marks,\n       CASE\n         WHEN marks >= 40 THEN 'Pass'\n         ELSE 'Fail'\n       END AS result_status\nFROM students;"
      ),
    ];
  }
  if (normalized.includes("select")) {
    return [
      exampleBlock("Basic Projection", "Select only the columns you need from a table.", "SELECT name, department\nFROM students;"),
      exampleBlock("Calculated Column", "Create a derived value in the output using an arithmetic expression.", "SELECT employee_name,\n       salary,\n       salary * 12 AS annual_salary\nFROM employees;"),
      exampleBlock("Distinct Sorted Output", "Combine SELECT with DISTINCT and ORDER BY to produce a clean reporting list.", "SELECT DISTINCT city\nFROM customers\nORDER BY city;"),
    ];
  }
  if (normalized === "from") {
    return [
      exampleBlock("Single Source Table", "FROM tells SQL where the data comes from.", "SELECT student_name, marks\nFROM students;"),
      exampleBlock("Aliased Source", "An alias makes longer queries easier to read.", "SELECT e.employee_name, e.salary\nFROM employees e;"),
    ];
  }
  if (normalized === "where") {
    return [
      exampleBlock("Simple Filter", "Keep only rows that satisfy one condition.", "SELECT student_name, marks\nFROM students\nWHERE marks > 80;"),
      exampleBlock("Business Filter", "Use WHERE to narrow data before reporting or joining.", "SELECT order_id, amount\nFROM orders\nWHERE amount >= 1000;"),
    ];
  }
  if (normalized.includes("create table")) {
    return [
      exampleBlock("Student Table", "Create a table with key student columns and one primary key.", "CREATE TABLE students (\n  student_id INT PRIMARY KEY,\n  student_name VARCHAR(100) NOT NULL,\n  department VARCHAR(50),\n  joined_on DATE\n);"),
      exampleBlock("Orders Table With Relationship", "This version adds a foreign key so students can see how table design supports joins later.", "CREATE TABLE orders (\n  order_id INT PRIMARY KEY,\n  customer_id INT,\n  amount DECIMAL(10,2),\n  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)\n);"),
    ];
  }
  if (normalized.includes("alter")) {
    return [
      exampleBlock("Add New Column", "ALTER TABLE can evolve an existing schema when business needs change.", "ALTER TABLE students\nADD email VARCHAR(150);"),
      exampleBlock("Change Column Size", "This example expands a text field when the original length becomes too small.", "ALTER TABLE students\nALTER COLUMN student_name TYPE VARCHAR(200);"),
    ];
  }
  if (normalized.includes("insert")) {
    return [
      exampleBlock("Single Row Insert", "Insert one record into the students table.", "INSERT INTO students (student_id, student_name, department)\nVALUES (1, 'Asha', 'CSE');"),
      exampleBlock("Multi Row Insert", "Insert multiple rows in one statement to reduce repeated commands.", "INSERT INTO students (student_id, student_name, department)\nVALUES (2, 'Ravi', 'ECE'),\n       (3, 'Neha', 'IT');"),
    ];
  }
  if (normalized.includes("update")) {
    return [
      exampleBlock("Department Raise", "Update only one group of employees using a WHERE clause.", "UPDATE employees\nSET salary = salary + 5000\nWHERE department = 'IT';"),
      exampleBlock("Grade Assignment", "UPDATE can also fill derived status values in existing rows.", "UPDATE students\nSET grade = 'A'\nWHERE marks >= 90;"),
    ];
  }
  if (normalized.includes("delete")) {
    return [
      exampleBlock("Delete One Student", "Delete one exact row by targeting the primary key.", "DELETE FROM students\nWHERE student_id = 10;"),
      exampleBlock("Delete Low Salary Records", "Remove rows that meet a business rule condition.", "DELETE FROM employees\nWHERE salary < 20000;"),
    ];
  }
  if (normalized.includes("join")) {
    return [
      exampleBlock("Customer Orders Join", "Match customer rows with their orders using the shared customer_id column.", "SELECT c.customer_name, o.order_id, o.amount\nFROM customers c\nINNER JOIN orders o\n  ON c.customer_id = o.customer_id;"),
      exampleBlock("Employee Department Join", "Bring department names into the employee result instead of only showing department ids.", "SELECT e.employee_name, d.department_name\nFROM employees e\nLEFT JOIN departments d\n  ON e.department_id = d.department_id;"),
    ];
  }
  if (normalized.includes("group by")) {
    return [
      exampleBlock("Department Count", "GROUP BY combines all rows of the same department into one summary row.", "SELECT department,\n       COUNT(*) AS employee_count\nFROM employees\nGROUP BY department;"),
      exampleBlock("Monthly Revenue Summary", "Use GROUP BY on a derived month value to create a time-based business report.", "SELECT substr(order_date, 1, 7) AS order_month,\n       SUM(amount) AS total_revenue\nFROM orders\nGROUP BY substr(order_date, 1, 7)\nORDER BY order_month;"),
    ];
  }
  if (normalized.includes("having")) {
    return [
      exampleBlock("Keep Only Large Groups", "HAVING filters grouped output after COUNT has already been calculated.", "SELECT department,\n       COUNT(*) AS employee_count\nFROM employees\nGROUP BY department\nHAVING COUNT(*) >= 3;"),
      exampleBlock("Average Salary Threshold", "Use HAVING when the filter depends on an aggregate like AVG or SUM.", "SELECT department,\n       AVG(salary) AS avg_salary\nFROM employees\nGROUP BY department\nHAVING AVG(salary) > 50000;"),
    ];
  }
  if (normalized.includes("subquery") || normalized.includes("exists")) {
    return [
      exampleBlock("Compare Against Overall Average", "The inner query returns one value and the outer query compares every row to that value.", "SELECT employee_name, salary\nFROM employees\nWHERE salary > (\n  SELECT AVG(salary)\n  FROM employees\n);"),
      exampleBlock("EXISTS Example", "EXISTS checks whether at least one related row is present.", "SELECT customer_name\nFROM customers c\nWHERE EXISTS (\n  SELECT 1\n  FROM orders o\n  WHERE o.customer_id = c.customer_id\n);"),
    ];
  }
  if (normalized.includes("window")) {
    return [
      exampleBlock("ROW_NUMBER Ranking", "Assign a running position to each employee after sorting by salary.", "SELECT employee_name,\n       salary,\n       ROW_NUMBER() OVER (ORDER BY salary DESC) AS salary_rank\nFROM employees;"),
      exampleBlock("Running Total", "Keep every order row and add a cumulative total beside it.", "SELECT order_date,\n       amount,\n       SUM(amount) OVER (ORDER BY order_date) AS running_total\nFROM orders;"),
    ];
  }
  if (normalized.includes("cte")) {
    return [
      exampleBlock("Named Intermediate Result", "A CTE makes a complex query easier to read by naming an intermediate calculation.", "WITH dept_totals AS (\n  SELECT department_id,\n         SUM(salary) AS total_salary\n  FROM employees\n  GROUP BY department_id\n)\nSELECT *\nFROM dept_totals;"),
    ];
  }
  if (normalized.includes("index") || normalized.includes("explain") || normalized.includes("sargable")) {
    return [
      exampleBlock("Execution Plan Check", "Use EXPLAIN to see whether the optimizer chooses a scan or an index-based lookup.", "EXPLAIN SELECT *\nFROM employees\nWHERE employee_id = 1001;"),
      exampleBlock("Create Helpful Index", "Add an index on a frequently filtered join column.", "CREATE INDEX idx_orders_customer_id\nON orders(customer_id);"),
    ];
  }
  if (normalized.includes("transaction") || normalized.includes("commit") || normalized.includes("rollback") || normalized.includes("savepoint")) {
    return [
      exampleBlock("Money Transfer", "A transaction groups both account updates so they succeed together.", "BEGIN TRANSACTION;\nUPDATE accounts SET balance = balance - 500 WHERE account_id = 1;\nUPDATE accounts SET balance = balance + 500 WHERE account_id = 2;\nCOMMIT;"),
      exampleBlock("Savepoint Rollback", "A savepoint lets you undo only part of a transaction instead of losing all progress.", "BEGIN TRANSACTION;\nSAVEPOINT before_discount;\nUPDATE products SET price = price * 0.9;\nROLLBACK TO before_discount;"),
    ];
  }
  if (normalized.includes("normalization") || normalized.includes("relationship") || normalized.includes("schema") || normalized.includes("keys")) {
    return [
      exampleBlock("Normalized Customer Order Model", "Separate customers, orders, and order_items so repeated customer data does not appear on every order line.", "customers(customer_id, customer_name)\norders(order_id, customer_id, order_date)\norder_items(order_id, product_id, quantity)"),
      exampleBlock("Parent Child Relationship", "The foreign key in orders.customer_id points back to customers.customer_id.", "SELECT c.customer_name, o.order_id\nFROM customers c\nJOIN orders o ON c.customer_id = o.customer_id;"),
    ];
  }
  if (normalized.includes("function")) {
    return [
      exampleBlock("String Function", "Transform text to uppercase for standardized output.", "SELECT UPPER(student_name) AS name_upper\nFROM students;"),
      exampleBlock("Numeric And NULL Function", "Round salaries and provide a fallback value when phone is missing.", "SELECT ROUND(salary, 2) AS rounded_salary,\n       COALESCE(phone, 'Not Available') AS phone_display\nFROM employees;"),
    ];
  }
  if (normalized.includes("where") || normalized.includes("and") || normalized.includes("in") || normalized.includes("between") || normalized.includes("like") || normalized.includes("null")) {
    return [
      exampleBlock("Multi Condition Filter", "This query shows how filters narrow the data set before the result is shown.", "SELECT *\nFROM students\nWHERE department = 'CSE'\n  AND marks > 80;"),
      exampleBlock("Pattern Or Range Filter", "Use BETWEEN for numeric/date ranges and LIKE for text patterns.", "SELECT *\nFROM customers\nWHERE city LIKE 'H%'\n   OR credit_score BETWEEN 700 AND 850;"),
    ];
  }
  if (normalized === "distinct") {
    return [
      exampleBlock("Unique Cities", "DISTINCT removes duplicate projected values from the result.", "SELECT DISTINCT city\nFROM customers;"),
      exampleBlock("Unique Department List", "This is useful when you want one row per category value.", "SELECT DISTINCT department\nFROM employees\nORDER BY department;"),
    ];
  }
  if (normalized === "order by") {
    return [
      exampleBlock("Ascending Sort", "ORDER BY arranges rows from small to large or A to Z by default.", "SELECT employee_name, salary\nFROM employees\nORDER BY salary;"),
      exampleBlock("Multiple Sort Keys", "Sort by department first and then salary within each department.", "SELECT employee_name, department, salary\nFROM employees\nORDER BY department, salary DESC;"),
    ];
  }
  if (normalized.includes("limit")) {
    return [
      exampleBlock("Top 5 Orders", "LIMIT keeps only the first few rows after sorting.", "SELECT order_id, amount\nFROM orders\nORDER BY amount DESC\nLIMIT 5;"),
      exampleBlock("Latest 3 Students", "Use LIMIT with ORDER BY when you want just the most recent records.", "SELECT student_name, joined_on\nFROM students\nORDER BY joined_on DESC\nLIMIT 3;"),
    ];
  }

  return [
    exampleBlock(
      `${title} core example`,
      `This example is tailored for ${title} inside ${moduleTitle} and shows the main pattern students should remember first.`,
      `SELECT *\nFROM sample_table\n-- Replace sample_table with the real table for ${title}`
    ),
    exampleBlock(
      `${title} business example`,
      `This second example shows how ${title} would appear inside a slightly more realistic report or application query.`,
      `SELECT column_name\nFROM sample_table\nWHERE condition_applies_to_${slugify(title).replace(/-/g, "_")};`
    ),
  ];
};

const buildTableExample = (topicItem) => {
  const normalized = topicItem.title.toLowerCase();

  if (normalized.includes("join")) {
    return {
      title: "Input Tables",
      explanation: "Use these sample tables to see which rows match and which rows stay unmatched during the join.",
      tables: [
        {
          name: "customers",
          headers: ["customer_id", "customer_name"],
          rows: [
            ["1", "Asha"],
            ["2", "Ravi"],
            ["3", "Meera"],
          ],
        },
        {
          name: "orders",
          headers: ["order_id", "customer_id", "amount"],
          rows: [
            ["101", "1", "1200"],
            ["102", "1", "800"],
            ["103", "2", "650"],
          ],
        },
      ],
      resultTable: {
        name: "joined_result",
        headers: ["customer_name", "order_id", "amount"],
        rows: [
          ["Asha", "101", "1200"],
          ["Asha", "102", "800"],
          ["Ravi", "103", "650"],
          ["Meera", "NULL", "NULL"],
        ],
      },
    };
  }

  if (normalized.includes("group by") || normalized.includes("having") || normalized.includes("aggregate")) {
    return {
      title: "Grouping Table Example",
      explanation: "Start with row-level data, then group rows with the same department to produce summary values.",
      tables: [
        {
          name: "employees",
          headers: ["emp_id", "department", "salary"],
          rows: [
            ["1", "IT", "50000"],
            ["2", "IT", "65000"],
            ["3", "HR", "42000"],
            ["4", "HR", "46000"],
            ["5", "Sales", "55000"],
          ],
        },
      ],
      resultTable: {
        name: "grouped_output",
        headers: ["department", "employee_count", "avg_salary"],
        rows: [
          ["IT", "2", "57500"],
          ["HR", "2", "44000"],
          ["Sales", "1", "55000"],
        ],
      },
    };
  }

  if (normalized.includes("where") || normalized.includes("between") || normalized.includes("like") || normalized.includes("null") || normalized.includes("in") || normalized.includes("and, or, not")) {
    return {
      title: "Filtering Table Example",
      explanation: "The query first reads all rows, then keeps only rows that satisfy the filter condition.",
      tables: [
        {
          name: "students",
          headers: ["student_id", "student_name", "department", "marks"],
          rows: [
            ["1", "Asha", "CSE", "91"],
            ["2", "Ravi", "ECE", "74"],
            ["3", "Neha", "CSE", "85"],
            ["4", "Vikram", "IT", "67"],
          ],
        },
      ],
      resultTable: {
        name: "filtered_output",
        headers: ["student_id", "student_name", "department", "marks"],
        rows: [
          ["1", "Asha", "CSE", "91"],
          ["3", "Neha", "CSE", "85"],
        ],
      },
    };
  }

  if (normalized.includes("window")) {
    return {
      title: "Window Function Example",
      explanation: "Notice that window functions keep all original rows but add an analytical value beside each row.",
      tables: [
        {
          name: "employees",
          headers: ["employee_name", "department", "salary"],
          rows: [
            ["Asha", "IT", "90000"],
            ["Ravi", "IT", "82000"],
            ["Meera", "HR", "75000"],
            ["Kiran", "HR", "70000"],
          ],
        },
      ],
      resultTable: {
        name: "window_output",
        headers: ["employee_name", "department", "salary", "rank_in_department"],
        rows: [
          ["Asha", "IT", "90000", "1"],
          ["Ravi", "IT", "82000", "2"],
          ["Meera", "HR", "75000", "1"],
          ["Kiran", "HR", "70000", "2"],
        ],
      },
    };
  }

  if (normalized.includes("normalization") || normalized.includes("relationship") || normalized.includes("schema") || normalized.includes("keys")) {
    return {
      title: "Design Table Example",
      explanation: "A good schema separates entities into related tables instead of storing everything in one big repeated table.",
      tables: [
        {
          name: "customers",
          headers: ["customer_id", "customer_name"],
          rows: [
            ["1", "Asha Stores"],
            ["2", "Ravi Traders"],
          ],
        },
        {
          name: "orders",
          headers: ["order_id", "customer_id", "order_date"],
          rows: [
            ["501", "1", "2026-04-01"],
            ["502", "2", "2026-04-03"],
          ],
        },
      ],
      resultTable: {
        name: "relationship_view",
        headers: ["customer_name", "order_id", "order_date"],
        rows: [
          ["Asha Stores", "501", "2026-04-01"],
          ["Ravi Traders", "502", "2026-04-03"],
        ],
      },
    };
  }

  return {
    title: "Sample Table Example",
    explanation: `This sample data shows how ${topicItem.title} works before and after the SQL statement is applied.`,
    tables: [
      {
        name: "sample_table",
        headers: ["id", "name", "value"],
        rows: [
          ["1", "Asha", "10"],
          ["2", "Ravi", "20"],
          ["3", "Neha", "30"],
        ],
      },
    ],
    resultTable: {
      name: "result_preview",
      headers: ["id", "name", "value"],
      rows: [
        ["1", "Asha", "10"],
        ["2", "Ravi", "20"],
      ],
    },
  };
};

const buildStepByStep = (topicItem) => {
  const normalized = topicItem.title.toLowerCase();

  if (normalized.includes("join")) {
    return [
      "Step 1: SQL reads rows from the left and right tables listed in the FROM and JOIN clauses.",
      "Step 2: The join condition compares the matching key columns such as customer_id or department_id.",
      "Step 3: Depending on the join type, matched rows are combined and unmatched rows may be kept or removed.",
      "Step 4: The SELECT list formats the final joined result shown to the student.",
    ];
  }
  if (normalized.includes("group by")) {
    return [
      "Step 1: SQL reads all input rows from the source table.",
      "Step 2: Rows with the same grouping column value are placed into the same group.",
      "Step 3: Aggregate functions such as COUNT, SUM, and AVG run once for each group.",
      "Step 4: SQL returns one summary row per group instead of one row per original record.",
    ];
  }
  if (normalized.includes("having")) {
    return [
      "Step 1: SQL first forms groups using GROUP BY.",
      "Step 2: Aggregate values are calculated for each group.",
      "Step 3: HAVING filters those grouped results using aggregate conditions.",
      "Step 4: Only the groups that satisfy the HAVING rule appear in the output.",
    ];
  }
  if (normalized.includes("window")) {
    return [
      "Step 1: SQL keeps the original input rows instead of collapsing them.",
      "Step 2: The OVER clause defines how rows should be partitioned and ordered.",
      "Step 3: The window function calculates a value across the visible frame of rows.",
      "Step 4: SQL adds that analytical value as a new output column beside each row.",
    ];
  }
  if (normalized.includes("subquery") || normalized.includes("exists")) {
    return [
      "Step 1: SQL identifies the inner query and evaluates it first or repeatedly depending on the type.",
      "Step 2: The subquery returns a single value, a list of values, or an existence check.",
      "Step 3: The outer query uses that result inside WHERE, SELECT, or FROM.",
      "Step 4: SQL returns only the rows that satisfy the outer condition.",
    ];
  }
  if (normalized.includes("case")) {
    return [
      "Step 1: SQL reads each row from the source table.",
      "Step 2: CASE checks the conditions from top to bottom.",
      "Step 3: The first matching condition decides the output label or value.",
      "Step 4: If no condition matches, the ELSE value is returned.",
    ];
  }

  return [
    "Step 1: SQL reads the required rows from the source table or object.",
    "Step 2: The topic-specific rule is applied to those rows.",
    "Step 3: SQL formats the selected or transformed values into the result set.",
    "Step 4: The final output is returned to the user or application.",
  ];
};

const buildExpectedOutput = (topicItem) => buildTableExample(topicItem).resultTable;

const buildCommonConfusions = (topicItem) => {
  const normalized = topicItem.title.toLowerCase();

  if (normalized.includes("group by")) {
    return [
      "GROUP BY is not for sorting. It is for combining rows into summary groups.",
      "DISTINCT removes duplicates, but GROUP BY is used when aggregates are involved.",
      "Every non-aggregated selected column usually needs to appear in the GROUP BY list.",
    ];
  }
  if (normalized.includes("having")) {
    return [
      "WHERE filters rows before grouping, while HAVING filters groups after aggregation.",
      "Students often try to use COUNT or AVG in WHERE, but that belongs in HAVING.",
    ];
  }
  if (normalized.includes("join")) {
    return [
      "A JOIN condition belongs in the ON clause, not as a random filter without context.",
      "LEFT JOIN keeps unmatched rows from the left table, but INNER JOIN removes them.",
      "Duplicate rows after joins usually mean one side has multiple matching records.",
    ];
  }
  if (normalized.includes("case")) {
    return [
      "CASE does not filter rows. It creates a derived value in the result or update logic.",
      "CASE checks conditions from top to bottom, so order matters.",
    ];
  }
  if (normalized.includes("window")) {
    return [
      "Window functions do not reduce rows like GROUP BY does.",
      "ROW_NUMBER, RANK, and DENSE_RANK look similar, but they behave differently when ties appear.",
    ];
  }
  if (normalized.includes("truncate") || normalized.includes("delete") || normalized.includes("drop")) {
    return [
      "DELETE removes rows, TRUNCATE clears table data fast, and DROP removes the table itself.",
      "Students often confuse data removal with structure removal.",
    ];
  }

  return [
    `Students often confuse ${topicItem.title} with a nearby SQL concept, so always compare purpose, syntax, and result shape.`,
    "Look at the sample table, run the example mentally, and then compare the expected output.",
  ];
};

const buildMiniPractice = (topicItem) => [
  `Write one simple query that demonstrates ${topicItem.title}.`,
  `Use the sample table on this page and predict the output before reading the answer.`,
  `Explain in one or two lines why ${topicItem.title} is the correct SQL concept for this case.`,
];

const buildExampleSteps = (topicItem) => {
  const normalized = topicItem.title.toLowerCase();

  if (normalized.includes("case")) {
    return [
      "Step 1: SQL reads each row from the source table.",
      "Step 2: CASE evaluates the conditions from top to bottom.",
      "Step 3: The first matching condition decides the returned label or value.",
      "Step 4: SQL shows the original columns together with the CASE-based output column.",
    ];
  }
  if (normalized.includes("join")) {
    return [
      "Step 1: SQL reads rows from the left table in the FROM clause.",
      "Step 2: SQL reads rows from the right table in the JOIN clause.",
      "Step 3: The ON condition compares the matching key columns.",
      "Step 4: SQL produces combined rows according to the selected join type.",
    ];
  }
  if (normalized.includes("group by")) {
    return [
      "Step 1: SQL reads all input rows from the source table.",
      "Step 2: Rows with the same grouping key are collected together.",
      "Step 3: Aggregate functions calculate a summary for each group.",
      "Step 4: SQL returns one result row per group.",
    ];
  }
  if (normalized.includes("having")) {
    return [
      "Step 1: SQL first groups the rows.",
      "Step 2: Aggregate values like COUNT or AVG are computed.",
      "Step 3: HAVING checks those grouped values.",
      "Step 4: Only matching groups remain in the output.",
    ];
  }
  if (normalized.includes("subquery") || normalized.includes("exists")) {
    return [
      "Step 1: SQL evaluates the inner query.",
      "Step 2: The inner query returns a value, set, or existence result.",
      "Step 3: The outer query uses that result in its condition.",
      "Step 4: SQL returns the outer rows that satisfy the condition.",
    ];
  }
  if (normalized.includes("window")) {
    return [
      "Step 1: SQL keeps all original rows in the result.",
      "Step 2: The OVER clause defines ordering or partitioning.",
      "Step 3: The window function calculates an analytical value across nearby rows.",
      "Step 4: SQL adds that value as a new output column without collapsing rows.",
    ];
  }

  return [
    "Step 1: SQL reads the input rows used by this example.",
    "Step 2: The main topic rule is applied to those rows.",
    "Step 3: SQL prepares the requested output columns or structural change.",
    "Step 4: The final result is returned.",
  ];
};

const enrichExamples = (topicItem, examples) =>
  examples.map((example) => ({
    ...example,
    beforeQuery: {
      title: "Before Query",
      tables: buildTableExample(topicItem).tables,
    },
    afterQuery: {
      title: "After Query",
      table: buildExpectedOutput(topicItem),
    },
    steps: buildExampleSteps(topicItem),
  }));

const buildDiagram = (topicItem) => {
  const normalized = topicItem.title.toLowerCase();

  if (normalized.includes("join")) {
    return {
      type: "join",
      title: "Join Flow Diagram",
      nodes: ["Left table", "Match by key", "Right table", "Joined rows"],
      caption: "The engine compares key columns from both tables and produces matched rows based on the join type.",
    };
  }
  if (normalized.includes("group by") || normalized.includes("having")) {
    return {
      type: normalized.includes("having") ? "having" : "group-by",
      title: "GROUP BY Flow Diagram",
      nodes: ["Raw rows", "Group same values", "Apply COUNT/SUM/AVG", "Summary result"],
      caption: "GROUP BY compresses many detail rows into fewer summary rows.",
    };
  }
  if (normalized.includes("window")) {
    return {
      type: "window",
      title: "Window Function Diagram",
      nodes: ["Original rows", "Define partition", "Order rows", "Add analytical column"],
      caption: "Window functions keep each row and calculate a value across a logical frame.",
    };
  }
  if (normalized.includes("subquery") || normalized.includes("exists")) {
    return {
      type: "subquery",
      title: "Subquery Diagram",
      nodes: ["Outer query", "Run inner query", "Return value/set", "Apply condition"],
      caption: "The outer query uses the result of the inner query to decide which rows to keep.",
    };
  }
  if (normalized.includes("normalization") || normalized.includes("relationship")) {
    return {
      type: "normalization",
      title: "Normalization Diagram",
      nodes: ["Single wide table", "Split entities", "Create keys", "Join when needed"],
      caption: "Normalization reduces repeated data by splitting one large table into related tables.",
    };
  }
  if (normalized.includes("create table") || normalized.includes("alter") || normalized.includes("drop") || normalized.includes("truncate")) {
    return {
      type: "ddl",
      title: "DDL Diagram",
      nodes: ["SQL command", "Validate syntax", "Update metadata", "Change structure"],
      caption: "DDL commands mainly change schema metadata and table structure.",
    };
  }
  if (normalized.includes("insert") || normalized.includes("update") || normalized.includes("delete") || normalized.includes("merge")) {
    return {
      type: "dml",
      title: "DML Diagram",
      nodes: ["Find target rows", "Check constraints", "Modify data pages", "Write transaction log"],
      caption: "DML commands change row-level data and usually create log records for recovery.",
    };
  }

  return {
    type: "generic",
    title: "Concept Diagram",
    nodes: ["Understand input", "Apply SQL rule", "Process rows", "Get result"],
    caption: `${topicItem.title} can be understood as a flow from source data to final result.`,
  };
};

const buildSubtopicExamples = (topicItem) =>
  (topicItem.subtopics || []).map((subtopicName, index) => ({
    id: `${topicItem.id}-sub-${index + 1}`,
    title: subtopicName,
    explanation: `${subtopicName} is a focused part of ${topicItem.title}. Students should first understand what input values look like, then see how SQL transforms them into the output.`,
    sql:
      subtopicName === "COUNT"
        ? "SELECT department, COUNT(*) AS employee_count\nFROM employees\nGROUP BY department;"
        : subtopicName === "SUM"
          ? "SELECT department, SUM(salary) AS total_salary\nFROM employees\nGROUP BY department;"
          : subtopicName === "AVG"
            ? "SELECT department, AVG(salary) AS avg_salary\nFROM employees\nGROUP BY department;"
            : subtopicName === "MIN"
              ? "SELECT department, MIN(salary) AS minimum_salary\nFROM employees\nGROUP BY department;"
              : subtopicName === "MAX"
                ? "SELECT department, MAX(salary) AS maximum_salary\nFROM employees\nGROUP BY department;"
                : subtopicName === "ROW_NUMBER"
                  ? "SELECT employee_name, salary,\n       ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_num\nFROM employees;"
                  : subtopicName === "RANK"
                    ? "SELECT employee_name, salary,\n       RANK() OVER (ORDER BY salary DESC) AS salary_rank\nFROM employees;"
                    : subtopicName === "DENSE_RANK"
                      ? "SELECT employee_name, salary,\n       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank\nFROM employees;"
                      : subtopicName === "LAG / LEAD"
                        ? "SELECT order_date, amount,\n       LAG(amount) OVER (ORDER BY order_date) AS previous_amount,\n       LEAD(amount) OVER (ORDER BY order_date) AS next_amount\nFROM orders;"
                        : subtopicName === "Running Total"
                          ? "SELECT order_date, amount,\n       SUM(amount) OVER (ORDER BY order_date) AS running_total\nFROM orders;"
                          : subtopicName === "PRIMARY KEY"
                            ? "CREATE TABLE students (\n  student_id INT PRIMARY KEY,\n  student_name VARCHAR(100)\n);"
                            : subtopicName === "FOREIGN KEY"
                              ? "CREATE TABLE orders (\n  order_id INT PRIMARY KEY,\n  customer_id INT,\n  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)\n);"
                              : subtopicName === "UNIQUE"
                                ? "CREATE TABLE users (\n  user_id INT PRIMARY KEY,\n  email VARCHAR(150) UNIQUE\n);"
                                : subtopicName === "NOT NULL"
                                  ? "CREATE TABLE employees (\n  employee_id INT PRIMARY KEY,\n  employee_name VARCHAR(100) NOT NULL\n);"
                                  : subtopicName === "CHECK"
                                    ? "CREATE TABLE products (\n  product_id INT PRIMARY KEY,\n  price DECIMAL(10,2) CHECK (price > 0)\n);"
                                    : subtopicName === "DEFAULT"
                                      ? "CREATE TABLE tasks (\n  task_id INT PRIMARY KEY,\n  status VARCHAR(20) DEFAULT 'Pending'\n);"
                                      : subtopicName === "ROLLUP"
                                        ? "SELECT department, city, SUM(salary)\nFROM employees\nGROUP BY department, city WITH ROLLUP;"
                                        : subtopicName === "CUBE"
                                          ? "SELECT department, city, SUM(salary)\nFROM employees\nGROUP BY department, city WITH CUBE;"
                                          : `-- ${subtopicName}\nSELECT *\nFROM sample_table;`,
    table: {
      headers: ["input", "subtopic", "output idea"],
      rows: [
        ["Sample rows", subtopicName, "Apply the subtopic rule"],
        ["Grouped/sorted data", subtopicName, "Observe the changed output"],
      ],
    },
    visual: {
      nodes: ["Input data", subtopicName, "Readable result"],
      caption: `${subtopicName} changes one specific part of the ${topicItem.title} logic, and students should connect that change to the final output.`,
    },
  }));

const buildTopicContent = (topicItem) => {
  const normalized = topicItem.title.toLowerCase();
  const examples = enrichExamples(topicItem, buildExamples(topicItem.title, topicItem.moduleTitle));

  let syntax = "-- Syntax varies by database engine";
  if (normalized.includes("select")) syntax = "SELECT column_list\nFROM table_name\nWHERE condition\nORDER BY column_name;";
  else if (normalized.includes("from")) syntax = "SELECT column_list\nFROM table_name;";
  else if (normalized.includes("where")) syntax = "SELECT column_list\nFROM table_name\nWHERE condition;";
  else if (normalized.includes("create database")) syntax = "CREATE DATABASE database_name;";
  else if (normalized.includes("drop database")) syntax = "DROP DATABASE database_name;";
  else if (normalized.includes("create table")) syntax = "CREATE TABLE table_name (\n  column1 datatype,\n  column2 datatype\n);";
  else if (normalized.includes("alter")) syntax = "ALTER TABLE table_name\nADD column_name datatype;";
  else if (normalized.includes("drop table")) syntax = "DROP TABLE table_name;";
  else if (normalized.includes("truncate")) syntax = "TRUNCATE TABLE table_name;";
  else if (normalized.includes("insert")) syntax = "INSERT INTO table_name (column1, column2)\nVALUES (value1, value2);";
  else if (normalized.includes("update")) syntax = "UPDATE table_name\nSET column_name = value\nWHERE condition;";
  else if (normalized.includes("delete")) syntax = "DELETE FROM table_name\nWHERE condition;";
  else if (normalized.includes("merge")) syntax = "MERGE INTO target_table t\nUSING source_table s\nON (t.id = s.id)\nWHEN MATCHED THEN UPDATE SET t.col = s.col\nWHEN NOT MATCHED THEN INSERT (id, col) VALUES (s.id, s.col);";
  else if (normalized.includes("distinct")) syntax = "SELECT DISTINCT column_name\nFROM table_name;";
  else if (normalized.includes("order by")) syntax = "SELECT column_list\nFROM table_name\nORDER BY column_name ASC | DESC;";
  else if (normalized.includes("limit")) syntax = "SELECT column_list\nFROM table_name\nORDER BY column_name\nLIMIT n;";
  else if (normalized.includes("and, or, not")) syntax = "SELECT * FROM table_name\nWHERE condition1 AND condition2;";
  else if (normalized === "in") syntax = "SELECT * FROM table_name\nWHERE column_name IN (value1, value2, value3);";
  else if (normalized.includes("between")) syntax = "SELECT * FROM table_name\nWHERE column_name BETWEEN start_value AND end_value;";
  else if (normalized.includes("like")) syntax = "SELECT * FROM table_name\nWHERE column_name LIKE 'pattern%';";
  else if (normalized.includes("null")) syntax = "SELECT * FROM table_name\nWHERE column_name IS NULL;";
  else if (normalized.includes("join")) syntax = "SELECT a.column1, b.column2\nFROM table_a a\nJOIN table_b b ON a.key = b.key;";
  else if (normalized.includes("group by")) syntax = "SELECT column_name, aggregate_function(column_name)\nFROM table_name\nGROUP BY column_name;";
  else if (normalized.includes("having")) syntax = "SELECT column_name, COUNT(*)\nFROM table_name\nGROUP BY column_name\nHAVING COUNT(*) > 1;";
  else if (normalized.includes("subquery")) syntax = "SELECT column_name\nFROM table_name\nWHERE column_name = (SELECT expression FROM another_table);";
  else if (normalized.includes("case")) syntax = "SELECT column_name,\n       CASE WHEN condition THEN result ELSE default_result END AS alias_name\nFROM table_name;";
  else if (normalized.includes("window")) syntax = "SELECT column_name,\n       ROW_NUMBER() OVER (PARTITION BY group_column ORDER BY sort_column) AS row_num\nFROM table_name;";
  else if (normalized.includes("cte")) syntax = "WITH cte_name AS (\n  SELECT * FROM table_name\n)\nSELECT * FROM cte_name;";
  else if (normalized.includes("explain")) syntax = "EXPLAIN SELECT * FROM table_name WHERE indexed_column = value;";
  else if (normalized.includes("transaction")) syntax = "BEGIN TRANSACTION;\n-- SQL statements\nCOMMIT;";
  else if (normalized.includes("commit")) syntax = "COMMIT;";
  else if (normalized.includes("rollback")) syntax = "ROLLBACK;";
  else if (normalized.includes("savepoint")) syntax = "SAVEPOINT savepoint_name;";

  return {
    definition: [
      `${topicItem.title} is a core part of ${topicItem.moduleTitle}. You should know what it does, when to use it, and how it changes the behavior of a query or database object.`,
      `For this topic, the study goal is to understand the concept clearly, write the correct syntax confidently, and recognize practical interview and real-project use cases.`,
    ],
    syntax,
    examples,
    tableExample: buildTableExample(topicItem),
    diagram: buildDiagram(topicItem),
    subtopicExamples: buildSubtopicExamples(topicItem),
    stepByStep: buildStepByStep(topicItem),
    expectedOutput: buildExpectedOutput(topicItem),
    commonConfusions: buildCommonConfusions(topicItem),
    miniPractice: buildMiniPractice(topicItem),
    realWorld: `In real systems, ${topicItem.title} is used when teams need accurate, maintainable, and efficient SQL behavior inside applications, reporting queries, admin operations, or analytics pipelines.`,
    internals: `Internally, the database parser validates the ${topicItem.title} statement, the optimizer builds an execution strategy, and the engine runs that plan against storage, indexes, memory, and transaction logs.`,
    performance: [
      `Always think about row count, index usage, and predicate selectivity while using ${topicItem.title}.`,
      "Test queries on realistic data volume, not just tiny examples.",
      "Prefer readable SQL first, then optimize the slow part with evidence from execution plans.",
    ],
    mistakes: [
      `Using ${topicItem.title} without understanding clause order or engine behavior.`,
      "Ignoring NULL handling, duplicates, and unintended row multiplication.",
      "Writing queries that work on sample data but fail on production-sized tables.",
    ],
    interview: [
      `What problem does ${topicItem.title} solve in SQL?`,
      `How would you explain ${topicItem.title} to a beginner with one example?`,
      `What are the common mistakes or edge cases in ${topicItem.title}?`,
    ],
    practice: [
      `Write one simple query using ${topicItem.title}.`,
      `Write one business-style query using ${topicItem.title} with filtering or aggregation where relevant.`,
      "Explain why your query is correct and what result shape it returns.",
    ],
    summary: [
      `${topicItem.title} is an important building block inside ${topicItem.moduleTitle}.`,
      "You should be able to explain the concept, write the syntax, and adapt it to multiple examples.",
    ],
  };
};

export const SQL_STUDY_COURSE = {
  id: "sql-study",
  title: "SQL Tutorial",
  subtitle: "Module-by-module SQL study module with nested topics, detailed explanations, and imported source notes.",
  introLines: courseIntroLines,
  modules: OUTLINE_MODULES.map((module) => ({
    ...module,
    referenceLines: moduleReferenceMap[module.id] || [],
  })),
  topics: allTopics,
  stats: {
    chapters: OUTLINE_MODULES.length,
    items: allTopics.length,
  },
};

export const getSqlModuleById = (moduleId) => SQL_STUDY_COURSE.modules.find((module) => module.id === moduleId) || SQL_STUDY_COURSE.modules[0];
export const getSqlTopicById = (topicId) => SQL_STUDY_COURSE.topics.find((item) => item.id === topicId) || SQL_STUDY_COURSE.topics[0];
export const getSqlTopicIndex = (topicId) => SQL_STUDY_COURSE.topics.findIndex((item) => item.id === topicId);
export const getNextSqlTopicId = (topicId) => {
  const index = getSqlTopicIndex(topicId);
  if (index < 0 || index >= SQL_STUDY_COURSE.topics.length - 1) return null;
  return SQL_STUDY_COURSE.topics[index + 1].id;
};
export const getPreviousSqlTopicId = (topicId) => {
  const index = getSqlTopicIndex(topicId);
  if (index <= 0) return null;
  return SQL_STUDY_COURSE.topics[index - 1].id;
};
export const getTopicContent = (topicId) => buildTopicContent(getSqlTopicById(topicId));
