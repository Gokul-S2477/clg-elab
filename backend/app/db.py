import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DEFAULT_SQLITE_URL = "sqlite:///./erp_local.db"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
ACTIVE_DATABASE_URL = DATABASE_URL


def _build_engine(database_url: str):
    engine_args = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        engine_args["connect_args"] = {"check_same_thread": False}
    return create_engine(database_url, **engine_args)


def _can_connect(candidate_engine) -> bool:
    try:
        with candidate_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # pragma: no cover
        print(f"Warning: database connection failed: {exc}")
        return False


def _initialize_engine():
    global ACTIVE_DATABASE_URL

    preferred_engine = _build_engine(DATABASE_URL)
    if DATABASE_URL.startswith("sqlite"):
        ACTIVE_DATABASE_URL = DATABASE_URL
        return preferred_engine

    if _can_connect(preferred_engine):
        ACTIVE_DATABASE_URL = DATABASE_URL
        return preferred_engine

    print(f"Database connection failed for {DATABASE_URL}. Falling back to local SQLite at {DEFAULT_SQLITE_URL}")
    preferred_engine.dispose()
    ACTIVE_DATABASE_URL = DEFAULT_SQLITE_URL
    return _build_engine(DEFAULT_SQLITE_URL)


engine = _initialize_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_upgrades() -> None:
    inspector = inspect(engine)
    if "questions" in inspector.get_table_names():
        question_columns = {column["name"] for column in inspector.get_columns("questions")}
        with engine.begin() as connection:
            if "diagram_url" not in question_columns:
                connection.execute(text("ALTER TABLE questions ADD COLUMN diagram_url VARCHAR(1000)"))
            if "diagram_caption" not in question_columns:
                connection.execute(text("ALTER TABLE questions ADD COLUMN diagram_caption VARCHAR(500)"))
            if "sql_schema" not in question_columns:
                connection.execute(text("ALTER TABLE questions ADD COLUMN sql_schema TEXT"))
            if "expected_output" not in question_columns:
                connection.execute(text("ALTER TABLE questions ADD COLUMN expected_output TEXT"))
            if "sample_tables" not in question_columns:
                connection.execute(text("ALTER TABLE questions ADD COLUMN sample_tables JSON"))

    if "solutions" not in inspector.get_table_names():
        return

    solution_columns = {column["name"] for column in inspector.get_columns("solutions")}
    if "language" not in solution_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE solutions ADD COLUMN language VARCHAR(20) DEFAULT 'python'"))

    if "playground_saves" not in inspector.get_table_names():
        return

    playground_columns = {column["name"] for column in inspector.get_columns("playground_saves")}
    with engine.begin() as connection:
        if "extra" not in playground_columns:
            connection.execute(text("ALTER TABLE playground_saves ADD COLUMN extra JSON"))
        if "created_at" not in playground_columns:
            connection.execute(text("ALTER TABLE playground_saves ADD COLUMN created_at DATETIME"))
        if "updated_at" not in playground_columns:
            connection.execute(text("ALTER TABLE playground_saves ADD COLUMN updated_at DATETIME"))


def reset_database(drop_existing: bool = False) -> None:
    """Drop and recreate tables while handling Postgres and MySQL safely."""
    from app.models import user, practice_arena  # noqa: F401

    if drop_existing:
        low_url = ACTIVE_DATABASE_URL.lower()
        with engine.begin() as conn:
            try:
                if "mysql" in low_url:
                    conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
                    inspector = inspect(engine)
                    for table_name in inspector.get_table_names():
                        conn.execute(text(f"DROP TABLE IF EXISTS `{table_name}`"))
                    conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
                elif "postgres" in low_url or "postgresql" in low_url:
                    conn.execute(text("DROP SCHEMA public CASCADE"))
                    conn.execute(text("CREATE SCHEMA public"))
                else:
                    Base.metadata.drop_all(bind=engine)
            except Exception as exc:  # pragma: no cover
                print(f"Warning: unable to drop database cleanly: {exc}")

    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    seed_sample_question()


def get_db():
    """Provide a transactional scope around database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_sample_question() -> None:
    """Create a library of easy questions so the question bank is populated."""
    from app.models.practice_arena import (
        ApproachType,
        DifficultyLevel,
        Example,
        ProgrammingLanguage,
        Question,
        QuestionCategory,
        QuestionVisibility,
        Solution,
        StarterCode,
        TestCase,
    )
    from app.seed_solution_bank import get_seed_solutions

    def build_detailed_problem_statement(template: dict) -> str:
        tags = ", ".join(template.get("tags", [])) or "core problem-solving"
        lines = [
            f"You are working on the problem '{template.get('title', 'Practice Problem')}'.",
            template.get("problem_statement", "Solve the problem according to the given rules."),
            f"This question belongs to the {template.get('category', 'coding')} track and focuses on {tags}.",
            f"The expected difficulty is {template.get('difficulty', 'easy')}, so the goal is clear logic before micro-optimizations.",
            "Read the input carefully and map it to the function signature before writing code.",
            "Think about normal cases, edge cases, repeated values, and the smallest valid input.",
            "Your answer should match the required output format exactly so automated checking can validate it.",
            f"Use this implementation entry point: {template.get('function_signature', 'def solve(*args):')}",
            f"Input guideline: {template.get('input_format', 'Use the sample structure shown in the examples.')}",
            f"Output guideline: {template.get('output_format', 'Return the final answer in the requested format.')}",
            f"Constraints to respect: {template.get('constraints', 'Keep the solution within normal interview limits.')}",
            "A good solution should be easy to read, correct on all provided cases, and efficient enough for the input size.",
        ]
        return "\n".join(lines)

    def build_sql_problem_statement(template: dict) -> str:
        tags = ", ".join(template.get("tags", [])) or "sql querying"
        lines = [
            f"You are solving the SQL problem '{template.get('title', 'SQL Practice Problem')}'.",
            template.get("problem_statement", "Write an SQL query that satisfies the business requirement."),
            f"This question belongs to the SQL track and emphasizes {tags}.",
            "Read the table definitions carefully before writing the query so you understand keys, relationships, and available columns.",
            "Focus on producing the exact rows requested by the prompt, including the correct grouping, filtering, and ordering rules.",
            "When multiple tables are involved, identify the join path first and then apply filters in the correct stage of the query.",
            "Use aggregate functions, window functions, common table expressions, or subqueries only when they improve correctness or clarity.",
            f"Available tables for this problem:\n{template.get('sql_schema', 'Table definitions will be shown in the editor.')}",
            f"Expected output format: {template.get('output_format', 'Return the requested result set with the exact columns asked for.')}",
            f"Reference result snapshot: {template.get('expected_output', 'See the examples section for a sample output.')}",
            f"Constraints and assumptions: {template.get('constraints', 'Assume standard ANSI SQL behavior unless stated otherwise.')}",
            "A strong solution should be correct, readable, and easy to review during an interview or assessment.",
        ]
        return "\n".join(lines)

    sql_sample_tables = {
        "sql-second-highest-salary": [
            {"name": "Employee", "columns": ["id", "name", "salary"], "rows": [["1", "Asha", "100"], ["2", "Rahul", "300"], ["3", "Mina", "200"]]},
        ],
        "sql-department-highest-salary": [
            {"name": "Employee", "columns": ["id", "name", "salary", "departmentId"], "rows": [["1", "Asha", "90000", "1"], ["2", "Ravi", "85000", "1"], ["3", "Mina", "75000", "2"]]},
            {"name": "Department", "columns": ["id", "name"], "rows": [["1", "IT"], ["2", "HR"]]},
        ],
        "sql-customers-who-never-order": [
            {"name": "Customers", "columns": ["id", "name"], "rows": [["1", "Asha"], ["2", "Ravi"], ["3", "Mina"]]},
            {"name": "Orders", "columns": ["id", "customerId"], "rows": [["11", "1"], ["12", "3"]]},
        ],
        "sql-duplicate-emails": [
            {"name": "Person", "columns": ["id", "email"], "rows": [["1", "admin@example.com"], ["2", "team@example.com"], ["3", "admin@example.com"]]},
        ],
        "sql-rising-temperature": [
            {"name": "Weather", "columns": ["id", "recordDate", "temperature"], "rows": [["1", "2026-04-01", "20"], ["2", "2026-04-02", "23"], ["3", "2026-04-03", "19"], ["4", "2026-04-04", "22"]]},
        ],
        "sql-product-sales-analysis": [
            {"name": "Product", "columns": ["product_id", "product_name", "price"], "rows": [["1", "Laptop", "60000"], ["2", "Mouse", "500"]]},
            {"name": "Sales", "columns": ["sale_id", "product_id", "units"], "rows": [["1", "1", "2"], ["2", "2", "10"]]},
        ],
        "sql-monthly-transaction-totals": [
            {"name": "Transactions", "columns": ["id", "trans_date", "amount", "state"], "rows": [["1", "2026-01-02", "120.00", "approved"], ["2", "2026-01-09", "300.00", "approved"], ["3", "2026-01-18", "200.00", "declined"], ["4", "2026-01-22", "300.00", "approved"]]},
        ],
        "sql-managers-with-five-reports": [
            {"name": "Employee", "columns": ["id", "name", "department", "managerId"], "rows": [["1", "Sonia", "Engineering", "NULL"], ["2", "Asha", "Engineering", "1"], ["3", "Ravi", "Engineering", "1"], ["4", "Mina", "Engineering", "1"], ["5", "Kiran", "Engineering", "1"], ["6", "Devi", "Engineering", "1"]]},
        ],
        "sql-top-customer-by-orders": [
            {"name": "Customers", "columns": ["id", "name"], "rows": [["1", "Asha"], ["2", "Ravi"], ["3", "Mina"]]},
            {"name": "Orders", "columns": ["id", "customer_id", "order_date"], "rows": [["1", "1", "2026-03-01"], ["2", "1", "2026-03-06"], ["3", "2", "2026-03-07"]]},
        ],
        "sql-employees-earning-more-than-manager": [
            {"name": "Employee", "columns": ["id", "name", "salary", "managerId"], "rows": [["1", "Asha", "70000", "NULL"], ["2", "Ritu", "82000", "1"], ["3", "Manoj", "65000", "1"]]},
        ],
        "sql-daily-active-users": [
            {"name": "Activity", "columns": ["user_id", "session_id", "activity_date", "activity_type"], "rows": [["1", "10", "2026-04-01", "login"], ["1", "11", "2026-04-01", "purchase"], ["2", "20", "2026-04-01", "login"], ["3", "30", "2026-04-02", "login"]]},
        ],
    }

    question_templates = [
        {
            "title": "Two Sum Closest",
            "slug": "two-sum-closest",
            "tags": ["array", "two-pointers", "sorting"],
            "short_description": "Find two integers whose sum is nearest to the target.",
            "problem_statement": "Given an array of integers and a target, return the sum of the two numbers with the closest sum to the target.",
            "input_format": "Line 1: array nums in JSON format.\nLine 2: integer target.",
            "output_format": "Single integer showing the closest sum.",
            "function_signature": "def solve(nums, target):",
            "constraints": "2 <= len(nums) <= 1000\n-100 <= nums[i], target <= 100",
            "examples": [
                {"input": "[1, 2, 3, 4]\\n6", "output": "6", "explanation": "2 + 4 equals 6."}
            ],
            "test_cases": [
                {"input": "[1, 2, 3, 4]\\n6", "output": "6", "is_hidden": False},
                {"input": "[5, -3, 0]\\n2", "output": "2", "is_hidden": True},
            ],
        },
        {
            "title": "Running Sum",
            "slug": "running-sum",
            "tags": ["array", "prefix"],
            "short_description": "Build prefix sums for a positive sequence.",
            "problem_statement": "Generate an array where each position holds the sum of elements up to that index.",
            "input_format": "Line 1: array in JSON format.",
            "output_format": "Line 1: running sum array in JSON format.",
            "function_signature": "def solve(nums):",
            "constraints": "1 <= len(nums) <= 1000\n-100 <= nums[i] <= 100",
            "examples": [
                {"input": "[1, 2, 3]", "output": "[1, 3, 6]", "explanation": "Prefix sums."}
            ],
            "test_cases": [
                {"input": "[1, 2, 3]", "output": "[1, 3, 6]", "is_hidden": False},
                {"input": "[5, -2, 4]", "output": "[5, 3, 7]", "is_hidden": False},
            ],
        },
        {
            "title": "Count Distinct",
            "slug": "count-distinct",
            "tags": ["hashmap", "array"],
            "short_description": "Return how many unique values exist.",
            "problem_statement": "Given a list of integers, count how many distinct elements it contains.",
            "input_format": "One line with JSON list.",
            "output_format": "Single integer.",
            "function_signature": "def solve(nums):",
            "constraints": "1 <= len(nums) <= 1000\n-100 <= nums[i] <= 100",
            "examples": [
                {"input": "[1, 1, 2, 3]", "output": "3", "explanation": "Distinct values are 1, 2, 3."}
            ],
            "test_cases": [
                {"input": "[1, 1, 1]", "output": "1", "is_hidden": False},
                {"input": "[-1, 0, 1, -1]", "output": "3", "is_hidden": True},
            ],
        },
        {
            "title": "Merge Two Sorted",
            "slug": "merge-two-sorted",
            "tags": ["array", "merge-sort"],
            "short_description": "Combine two sorted lists.",
            "problem_statement": "Merge two sorted arrays into one sorted list without additional sorting steps.",
            "input_format": "Line 1: first array.\nLine 2: second array.",
            "output_format": "Single sorted array.",
            "function_signature": "def solve(nums1, nums2):",
            "constraints": "1 <= len(nums1) + len(nums2) <= 1000",
            "examples": [
                {"input": "[1, 3]\\n[2, 4]", "output": "[1, 2, 3, 4]", "explanation": "Simple merge."}
            ],
            "test_cases": [
                {"input": "[1, 3]\\n[2]", "output": "[1, 2, 3]", "is_hidden": False},
                {"input": "[]\\n[5]", "output": "[5]", "is_hidden": False},
            ],
        },
        {
            "title": "Balanced Brackets",
            "slug": "balanced-brackets",
            "tags": ["stack", "string"],
            "short_description": "Check if parentheses sequence is balanced.",
            "problem_statement": "Return true if every opening bracket has a corresponding closing bracket in order.",
            "input_format": "One string with brackets.",
            "output_format": "Boolean true/false.",
            "function_signature": "def solve(expression):",
            "constraints": "1 <= len(expression) <= 500",
            "examples": [
                {"input": "()[]{}", "output": "true", "explanation": "All balanced."}
            ],
            "test_cases": [
                {"input": "{[()]}", "output": "true", "is_hidden": False},
                {"input": "([)]", "output": "false", "is_hidden": True},
            ],
        },
        {
            "title": "FizzBuzz Sequence",
            "slug": "fizzbuzz-sequence",
            "tags": ["math", "loop"],
            "short_description": "Classic FizzBuzz generator.",
            "problem_statement": "Return first n entries where multiples of 3 become 'Fizz', multiples of 5 become 'Buzz', both become 'FizzBuzz'.",
            "input_format": "Single integer n.",
            "output_format": "Array of strings.",
            "function_signature": "def solve(n):",
            "constraints": "1 <= n <= 50",
            "examples": [
                {"input": "5", "output": '["1", "2", "Fizz", "4", "Buzz"]', "explanation": "Standard FizzBuzz."}
            ],
            "test_cases": [
                {"input": "3", "output": '["1", "2", "Fizz"]', "is_hidden": False},
                {"input": "7", "output": '["1", "2", "Fizz", "4", "Buzz", "Fizz", "7"]', "is_hidden": False},
            ],
        },
        {
            "title": "Max Pair Sum",
            "slug": "max-pair-sum",
            "tags": ["array", "sort"],
            "short_description": "Compute maximum sum of any two numbers.",
            "problem_statement": "Return the largest sum obtained by adding any two distinct numbers in the array.",
            "input_format": "One JSON list.",
            "output_format": "Single integer.",
            "function_signature": "def solve(nums):",
            "constraints": "2 <= len(nums) <= 1000",
            "examples": [
                {"input": "[1, 5, 3]", "output": "8", "explanation": "5 + 3 = 8."}
            ],
            "test_cases": [
                {"input": "[2, 2, 2]", "output": "4", "is_hidden": False},
                {"input": "[-1, 5, 6]", "output": "11", "is_hidden": True},
            ],
        },
        {
            "title": "Palindrome Check",
            "slug": "palindrome-check",
            "tags": ["string"],
            "short_description": "Verify palindrome ignoring case.",
            "problem_statement": "Return true if input string reads the same forward and backward.",
            "input_format": "One string.",
            "output_format": "Boolean as string.",
            "function_signature": "def solve(value):",
            "constraints": "1 <= len(value) <= 200",
            "examples": [
                {"input": "Level", "output": "true", "explanation": "Case-insensitive."}
            ],
            "test_cases": [
                {"input": "level", "output": "true", "is_hidden": False},
                {"input": "world", "output": "false", "is_hidden": True},
            ],
        },
        {
            "title": "Sort Colors",
            "slug": "sort-colors",
            "tags": ["array", "sorting"],
            "short_description": "Sort array containing 0, 1, 2.",
            "problem_statement": "Reorder the list so all zeros come first, ones next, and twos last.",
            "input_format": "One list of 0/1/2 integers.",
            "output_format": "Sorted list.",
            "function_signature": "def solve(nums):",
            "constraints": "1 <= len(nums) <= 500",
            "examples": [
                {"input": "[2, 0, 1, 2]", "output": "[0, 1, 2, 2]", "explanation": "Partition sort."}
            ],
            "test_cases": [
                {"input": "[2, 2, 1, 0]", "output": "[0, 1, 2, 2]", "is_hidden": False},
                {"input": "[1, 0, 1]", "output": "[0, 1, 1]", "is_hidden": False},
            ],
        },
        {
            "title": "Consecutive Sequence",
            "slug": "consecutive-sequence",
            "tags": ["array"],
            "short_description": "Find longest sequence of consecutive numbers.",
            "problem_statement": "Given an unsorted list, return the length of the longest set of consecutive integers.",
            "input_format": "One list.",
            "output_format": "Integer length.",
            "function_signature": "def solve(nums):",
            "constraints": "1 <= len(nums) <= 500",
            "examples": [
                {"input": "[1, 3, 2, 4]", "output": "4", "explanation": "1-4 chain."}
            ],
            "test_cases": [
                {"input": "[10, 9, 1, 2]", "output": "2", "is_hidden": False},
                {"input": "[5, 4, 3, 2, 1]", "output": "5", "is_hidden": True},
            ],
        },
    ]

    def compact_template(
        title: str,
        slug: str,
        tags: list[str],
        summary: str,
        statement: str,
        signature: str,
        example_input: str,
        example_output: str,
        visible_input: str,
        visible_output: str,
        hidden_input: str,
        hidden_output: str,
        difficulty: str = "easy",
    ) -> dict:
        return {
            "title": title,
            "slug": slug,
            "tags": tags,
            "difficulty": difficulty,
            "short_description": summary,
            "problem_statement": statement,
            "input_format": "Provide input exactly as shown in the examples.",
            "output_format": "Return the expected result for the given input.",
            "function_signature": signature,
            "constraints": "1 <= input size <= 1000",
            "examples": [
                {
                    "input": example_input,
                    "output": example_output,
                    "explanation": "Use the problem rules to compute the result.",
                }
            ],
            "test_cases": [
                {"input": visible_input, "output": visible_output, "is_hidden": False},
                {"input": hidden_input, "output": hidden_output, "is_hidden": True},
            ],
        }

    question_templates.extend(
        [
            compact_template("Valid Anagram", "valid-anagram", ["string", "hashmap"], "Check whether two strings are anagrams.", "Return true if both strings contain the same characters with the same frequencies.", "def solve(first, second):", "listen\nsilent", "true", "rat\ntar", "true", "rat\ncar", "false"),
            compact_template("Contains Duplicate", "contains-duplicate", ["array", "hashmap"], "Detect duplicate values in an array.", "Return true if any number appears at least twice.", "def solve(nums):", "[1,2,3,1]", "true", "[1,2,3]", "false", "[4,5,5,9]", "true"),
            compact_template("Best Time to Buy and Sell Stock", "best-time-to-buy-and-sell-stock", ["array", "greedy"], "Find the best single-transaction profit.", "Return the maximum profit from one buy and one sell.", "def solve(prices):", "[7,1,5,3,6,4]", "5", "[7,1,5,3,6,4]", "5", "[7,6,4,3,1]", "0"),
            compact_template("Move Zeroes", "move-zeroes", ["array", "two-pointers"], "Shift zeroes to the end in order.", "Return the array with zeroes moved to the end while preserving non-zero order.", "def solve(nums):", "[0,1,0,3,12]", "[1,3,12,0,0]", "[0,1,0,3,12]", "[1,3,12,0,0]", "[0,0,1]", "[1,0,0]"),
            compact_template("Product of Array Except Self", "product-of-array-except-self", ["array", "prefix"], "Build products without division.", "Return an array where each position is the product of all other positions.", "def solve(nums):", "[1,2,3,4]", "[24,12,8,6]", "[1,2,3,4]", "[24,12,8,6]", "[-1,1,0,-3,3]", "[0,0,9,0,0]", "medium"),
            compact_template("Maximum Subarray", "maximum-subarray", ["array", "dynamic-programming"], "Find the contiguous subarray with the largest sum.", "Return the maximum sum over all contiguous subarrays.", "def solve(nums):", "[-2,1,-3,4,-1,2,1,-5,4]", "6", "[-2,1,-3,4,-1,2,1,-5,4]", "6", "[1]", "1", "medium"),
            compact_template("Climbing Stairs", "climbing-stairs", ["dynamic-programming"], "Count ways to climb with 1 or 2 steps.", "Return the number of distinct ways to reach the top.", "def solve(n):", "3", "3", "2", "2", "5", "8"),
            compact_template("Min Cost Climbing Stairs", "min-cost-climbing-stairs", ["dynamic-programming"], "Reach the top with minimum cost.", "Given step costs, return the minimum total cost to reach the top.", "def solve(cost):", "[10,15,20]", "15", "[10,15,20]", "15", "[1,100,1,1,1,100,1,1,100,1]", "6", "medium"),
            compact_template("Binary Search", "binary-search", ["array", "binary-search"], "Return the target index from a sorted array.", "Use binary search and return -1 when the target is not present.", "def solve(nums, target):", "[-1,0,3,5,9,12]\n9", "4", "[-1,0,3,5,9,12]\n9", "4", "[-1,0,3,5,9,12]\n2", "-1"),
            compact_template("Search Insert Position", "search-insert-position", ["array", "binary-search"], "Find the insert position for a target.", "Return the target index or the place where it should be inserted.", "def solve(nums, target):", "[1,3,5,6]\n5", "2", "[1,3,5,6]\n2", "1", "[1,3,5,6]\n7", "4"),
            compact_template("Reverse String", "reverse-string", ["string", "two-pointers"], "Reverse the input string.", "Return the characters of the string in reverse order.", "def solve(text):", "hello", "olleh", "abcd", "dcba", "racecar", "racecar"),
            compact_template("First Unique Character", "first-unique-character", ["string", "hashmap"], "Find the first non-repeating character index.", "Return the index of the first unique character, or -1 if none exists.", "def solve(text):", "leetcode", "0", "loveleetcode", "2", "aabb", "-1"),
            compact_template("Longest Common Prefix", "longest-common-prefix", ["string"], "Find the longest shared starting substring.", "Return the longest common prefix among all words.", "def solve(words):", "[\"flower\",\"flow\",\"flight\"]", "fl", "[\"flower\",\"flow\",\"flight\"]", "fl", "[\"dog\",\"racecar\",\"car\"]", ""),
            compact_template("Roman to Integer", "roman-to-integer", ["string", "math"], "Convert a Roman numeral to an integer.", "Return the numeric value of the Roman numeral string.", "def solve(value):", "III", "3", "LVIII", "58", "MCMXCIV", "1994"),
            compact_template("Length of Last Word", "length-of-last-word", ["string"], "Count the final word length in a sentence.", "Return the length of the last word in the given sentence.", "def solve(sentence):", "Hello World", "5", "fly me to the moon", "4", "luffy is still joyboy", "6"),
            compact_template("Plus One", "plus-one", ["array", "math"], "Add one to a big integer array.", "Return the digits after incrementing the represented number by one.", "def solve(digits):", "[1,2,3]", "[1,2,4]", "[4,3,2,1]", "[4,3,2,2]", "[9]", "[1,0]"),
            compact_template("Sqrt Floor", "sqrt-floor", ["math", "binary-search"], "Return the integer square root.", "Return the floor of the square root of the given integer.", "def solve(x):", "8", "2", "4", "2", "15", "3"),
            compact_template("Pascal Triangle", "pascal-triangle", ["array", "dynamic-programming"], "Generate Pascal triangle rows.", "Return the first n rows of Pascal's triangle.", "def solve(num_rows):", "5", "[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]", "1", "[[1]]", "4", "[[1],[1,1],[1,2,1],[1,3,3,1]]"),
            compact_template("Single Number", "single-number", ["array", "bit-manipulation"], "Find the element that appears once.", "Every element appears twice except one. Return that one.", "def solve(nums):", "[2,2,1]", "1", "[4,1,2,1,2]", "4", "[1]", "1"),
            compact_template("Majority Element", "majority-element", ["array", "greedy"], "Find the element appearing more than n/2 times.", "Return the majority element in the array.", "def solve(nums):", "[3,2,3]", "3", "[2,2,1,1,1,2,2]", "2", "[1]", "1"),
            compact_template("Excel Sheet Column Number", "excel-sheet-column-number", ["string", "math"], "Convert spreadsheet column title to number.", "Return the numeric index of the Excel column title.", "def solve(column_title):", "AB", "28", "A", "1", "ZY", "701"),
            compact_template("Happy Number", "happy-number", ["math", "hashmap"], "Detect whether a number becomes 1.", "Return true if repeated squared-digit sums reach 1.", "def solve(n):", "19", "true", "19", "true", "2", "false"),
            compact_template("Isomorphic Strings", "isomorphic-strings", ["string", "hashmap"], "Check if two strings map consistently.", "Return true if there is a one-to-one character mapping between the strings.", "def solve(first, second):", "egg\nadd", "true", "paper\ntitle", "true", "foo\nbar", "false"),
            compact_template("Valid Palindrome", "valid-palindrome", ["string", "two-pointers"], "Ignore punctuation and case while checking palindrome.", "Return true if the alphanumeric characters form a palindrome.", "def solve(text):", "A man, a plan, a canal: Panama", "true", "race a car", "false", " ", "true"),
            compact_template("Intersection of Two Arrays", "intersection-of-two-arrays", ["array", "hashmap"], "Return distinct common elements of two arrays.", "Return the intersection of two arrays without duplicates.", "def solve(nums1, nums2):", "[1,2,2,1]\n[2,2]", "[2]", "[1,2,2,1]\n[2,2]", "[2]", "[4,9,5]\n[9,4,9,8,4]", "[4,9]"),
            compact_template("Missing Number", "missing-number", ["array", "math"], "Find the missing number from 0..n.", "Given distinct values from 0 to n, return the missing one.", "def solve(nums):", "[3,0,1]", "2", "[0,1]", "2", "[9,6,4,2,3,5,7,0,1]", "8"),
            compact_template("Find Difference of Two Arrays", "find-difference-of-two-arrays", ["array", "hashmap"], "Find unique values present in one array but not the other.", "Return the unique values in each array compared with the other.", "def solve(nums1, nums2):", "[1,2,3]\n[2,4,6]", "[[1,3],[4,6]]", "[1,2,3]\n[2,4,6]", "[[1,3],[4,6]]", "[1,1,2]\n[2,3,3]", "[[1],[3]]"),
            compact_template("Can Place Flowers", "can-place-flowers", ["array", "greedy"], "Check if more flowers can be planted.", "Return true if n flowers can be planted with no adjacent flowers.", "def solve(flowerbed, n):", "[1,0,0,0,1]\n1", "true", "[1,0,0,0,1]\n1", "true", "[1,0,0,0,1]\n2", "false"),
            compact_template("Kids With the Greatest Number of Candies", "kids-with-the-greatest-number-of-candies", ["array"], "Find which children can reach the maximum candies.", "Return booleans indicating whether each child can reach the greatest count.", "def solve(candies, extra_candies):", "[2,3,5,1,3]\n3", "[true,true,true,false,true]", "[2,3,5,1,3]\n3", "[true,true,true,false,true]", "[4,2,1,1,2]\n1", "[true,false,false,false,false]"),
            compact_template("Merge Strings Alternately", "merge-strings-alternately", ["string", "two-pointers"], "Merge two strings by alternating characters.", "Return a string built by alternating characters from each word.", "def solve(word1, word2):", "abc\npqr", "apbqcr", "ab\npqrs", "apbqrs", "abcd\npq", "apbqcd"),
            compact_template("Greatest Common Divisor of Strings", "greatest-common-divisor-of-strings", ["string", "math"], "Find the largest string that divides both strings.", "Return the longest repeating base string that forms both inputs.", "def solve(str1, str2):", "ABCABC\nABC", "ABC", "ABABAB\nABAB", "AB", "LEET\nCODE", ""),
            compact_template("Reverse Vowels", "reverse-vowels", ["string", "two-pointers"], "Reverse only the vowels in a string.", "Return the string after reversing vowel positions.", "def solve(text):", "hello", "holle", "leetcode", "leotcede", "aA", "Aa"),
            compact_template("Reverse Words in a String", "reverse-words-in-a-string", ["string"], "Reverse word order while trimming spaces.", "Return the sentence with words in reverse order and single spacing.", "def solve(sentence):", "the sky is blue", "blue is sky the", "  hello world  ", "world hello", "a good   example", "example good a"),
            compact_template("Increasing Triplet Subsequence", "increasing-triplet-subsequence", ["array", "greedy"], "Detect whether an increasing triplet exists.", "Return true if there exist three increasing values in order.", "def solve(nums):", "[1,2,3,4,5]", "true", "[5,4,3,2,1]", "false", "[2,1,5,0,4,6]", "true", "medium"),
            compact_template("String Compression", "string-compression", ["string", "two-pointers"], "Compress consecutive characters with counts.", "Return the compressed form of the string using counts for repeats.", "def solve(text):", "aabcccccaaa", "a2bc5a3", "aaabb", "a3b2", "abcd", "abcd", "medium"),
            compact_template("Maximum Average Subarray", "maximum-average-subarray", ["array", "sliding-window"], "Find the largest average over subarrays of length k.", "Return the maximum average of any contiguous subarray of length k.", "def solve(nums, k):", "[1,12,-5,-6,50,3]\n4", "12.75", "[1,12,-5,-6,50,3]\n4", "12.75", "[5]\n1", "5.0"),
            compact_template("Find Pivot Index", "find-pivot-index", ["array", "prefix"], "Find the index where left and right sums match.", "Return the pivot index where the left sum equals the right sum.", "def solve(nums):", "[1,7,3,6,5,6]", "3", "[1,7,3,6,5,6]", "3", "[1,2,3]", "-1"),
            compact_template("Find the Highest Altitude", "find-the-highest-altitude", ["array", "prefix"], "Track the highest altitude from gains.", "Starting from altitude 0, return the maximum altitude reached.", "def solve(gain):", "[-5,1,5,0,-7]", "1", "[-4,-3,-2,-1,4,3,2]", "0", "[-5,1,5,0,-7]", "1"),
            compact_template("Unique Number of Occurrences", "unique-number-of-occurrences", ["array", "hashmap"], "Check whether occurrence counts are unique.", "Return true if each value frequency is distinct.", "def solve(nums):", "[1,2,2,1,1,3]", "true", "[1,2,2,1,1,3]", "true", "[1,2]", "false"),
            compact_template("Determine if Two Strings Are Close", "determine-if-two-strings-are-close", ["string", "hashmap"], "Check closeness under allowed character operations.", "Return true if one string can transform into the other using the allowed operations.", "def solve(word1, word2):", "abc\nbca", "true", "cabbba\nabbccc", "true", "a\naa", "false", "medium"),
            compact_template("Equal Row and Column Pairs", "equal-row-and-column-pairs", ["array", "hashmap", "matrix"], "Count matching row-column pairs.", "Return the number of pairs where a row equals a column.", "def solve(grid):", "[[3,2,1],[1,7,6],[2,7,7]]", "1", "[[3,2,1],[1,7,6],[2,7,7]]", "1", "[[3,1,2,2],[1,4,4,5],[2,4,2,2],[2,4,2,2]]", "3", "medium"),
            compact_template("Maximum Depth of Binary Tree", "maximum-depth-of-binary-tree", ["tree", "depth-first-search"], "Find the maximum depth of a binary tree.", "Return the number of levels in the binary tree represented as level-order data.", "def solve(nodes):", "[3,9,20,null,null,15,7]", "3", "[3,9,20,null,null,15,7]", "3", "[1,null,2]", "2"),
            compact_template("Invert Binary Tree", "invert-binary-tree", ["tree", "breadth-first-search"], "Mirror a binary tree.", "Return the inverted tree as level-order data.", "def solve(nodes):", "[4,2,7,1,3,6,9]", "[4,7,2,9,6,3,1]", "[4,2,7,1,3,6,9]", "[4,7,2,9,6,3,1]", "[2,1,3]", "[2,3,1]"),
            compact_template("Same Tree", "same-tree", ["tree", "depth-first-search"], "Check whether two trees are identical.", "Return true if both trees have the same structure and values.", "def solve(tree1, tree2):", "[1,2,3]\n[1,2,3]", "true", "[1,2]\n[1,null,2]", "false", "[1,2,1]\n[1,1,2]", "false"),
            compact_template("Symmetric Tree", "symmetric-tree", ["tree", "breadth-first-search"], "Check whether a tree is symmetric.", "Return true if the tree mirrors around its center.", "def solve(nodes):", "[1,2,2,3,4,4,3]", "true", "[1,2,2,null,3,null,3]", "false", "[1,2,2,3,4,4,3]", "true"),
            compact_template("Path Sum", "path-sum", ["tree", "depth-first-search"], "Check whether a root-to-leaf path equals the target.", "Return true if any root-to-leaf path sum equals the target.", "def solve(nodes, target_sum):", "[5,4,8,11,null,13,4,7,2,null,null,null,1]\n22", "true", "[1,2,3]\n5", "false", "[5,4,8,11,null,13,4,7,2,null,null,null,1]\n22", "true"),
            compact_template("Summary Ranges", "summary-ranges", ["array"], "Summarize consecutive ranges in a sorted array.", "Return a list of string ranges representing the sorted unique integers.", "def solve(nums):", "[0,1,2,4,5,7]", "[\"0->2\",\"4->5\",\"7\"]", "[0,1,2,4,5,7]", "[\"0->2\",\"4->5\",\"7\"]", "[0,2,3,4,6,8,9]", "[\"0\",\"2->4\",\"6\",\"8->9\"]"),
            compact_template("Is Subsequence", "is-subsequence", ["string", "two-pointers"], "Check whether one string is a subsequence of another.", "Return true if the first string appears in order within the second.", "def solve(s, t):", "abc\nahbgdc", "true", "axc\nahbgdc", "false", "abc\nahbgdc", "true"),
            compact_template("Reverse Linked List Values", "reverse-linked-list-values", ["linked-list"], "Reverse a linked list represented as an array.", "Treat the input list as linked list values and return them reversed.", "def solve(values):", "[1,2,3,4,5]", "[5,4,3,2,1]", "[1,2]", "[2,1]", "[]", "[]"),
            compact_template("Middle of Linked List Values", "middle-of-linked-list-values", ["linked-list", "two-pointers"], "Return the middle node values as a trailing list.", "Return the values from the middle node to the end.", "def solve(values):", "[1,2,3,4,5]", "[3,4,5]", "[1,2,3,4,5,6]", "[4,5,6]", "[1]", "[1]"),
            compact_template("Remove Duplicates from Sorted Array", "remove-duplicates-from-sorted-array", ["array", "two-pointers"], "Return unique sorted values.", "Given a sorted array, return its unique values in order.", "def solve(nums):", "[1,1,2]", "[1,2]", "[0,0,1,1,1,2,2,3,3,4]", "[0,1,2,3,4]", "[1,1,1]", "[1]"),
            compact_template("Remove Element", "remove-element", ["array", "two-pointers"], "Remove all copies of a given value.", "Return the array after removing every instance of the target value.", "def solve(nums, val):", "[3,2,2,3]\n3", "[2,2]", "[3,2,2,3]\n3", "[2,2]", "[0,1,2,2,3,0,4,2]\n2", "[0,1,3,0,4]"),
        ]
    )

    sql_question_templates = [
        {
            "title": "Second Highest Salary",
            "slug": "sql-second-highest-salary",
            "difficulty": "easy",
            "category": "sql",
            "tags": ["sql", "subquery", "salary"],
            "short_description": "Return the second highest distinct salary from the employee table.",
            "problem_statement": "Write an SQL query to return the second highest distinct salary from the Employee table. If there is no second highest distinct salary, return NULL.",
            "sql_schema": "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- salary INT",
            "input_format": "Use the Employee table shown in the schema section.",
            "output_format": "Return one column named SecondHighestSalary.",
            "expected_output": "SecondHighestSalary\n200",
            "constraints": "Salaries may repeat. Use distinct salary values when deciding the second highest salary.",
            "examples": [
                {
                    "input": "Employee\n(1, 'Asha', 100)\n(2, 'Rahul', 300)\n(3, 'Mina', 200)",
                    "output": "SecondHighestSalary\n200",
                    "explanation": "The highest distinct salary is 300 and the second highest is 200.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT NULL AS SecondHighestSalary;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT MAX(salary) AS SecondHighestSalary\nFROM Employee\nWHERE salary < (SELECT MAX(salary) FROM Employee);",
                    "explanation": "Find the highest salary first, then take the maximum salary strictly below it.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT DISTINCT salary AS SecondHighestSalary\nFROM Employee\nORDER BY salary DESC\nLIMIT 1 OFFSET 1;",
                    "explanation": "Sort distinct salaries in descending order and pick the second row.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Department Highest Salary",
            "slug": "sql-department-highest-salary",
            "difficulty": "medium",
            "category": "sql",
            "tags": ["sql", "join", "group-by"],
            "short_description": "List the highest paid employee in each department.",
            "problem_statement": "Write an SQL query to find employees who have the highest salary in each department.",
            "sql_schema": "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- salary INT\n- departmentId INT\n\nTable: Department\n- id INT PRIMARY KEY\n- name VARCHAR(100)",
            "input_format": "Use Employee and Department.",
            "output_format": "Return columns Department, Employee, Salary.",
            "expected_output": "Department | Employee | Salary\nIT | Asha | 90000\nHR | Mina | 75000",
            "constraints": "Return all employees tied for the highest salary in a department.",
            "examples": [
                {
                    "input": "Employee rows joined with Department rows as described in the schema.",
                    "output": "Department | Employee | Salary\nIT | Asha | 90000",
                    "explanation": "Asha has the top salary inside the IT department.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON d.id = e.departmentId;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON d.id = e.departmentId\nJOIN (\n    SELECT departmentId, MAX(salary) AS max_salary\n    FROM Employee\n    GROUP BY departmentId\n) m ON m.departmentId = e.departmentId AND m.max_salary = e.salary;",
                    "explanation": "Compute the maximum salary per department first, then join employees who match it.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e\nJOIN Department d ON d.id = e.departmentId\nWHERE e.salary = (\n    SELECT MAX(e2.salary)\n    FROM Employee e2\n    WHERE e2.departmentId = e.departmentId\n);",
                    "explanation": "Use a correlated subquery to compare each employee against the top salary in the same department.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Customers Who Never Order",
            "slug": "sql-customers-who-never-order",
            "difficulty": "easy",
            "category": "sql",
            "tags": ["sql", "left-join", "null"],
            "short_description": "Find customers who do not appear in the Orders table.",
            "problem_statement": "Write an SQL query to report all customers who never placed an order.",
            "sql_schema": "Table: Customers\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n\nTable: Orders\n- id INT PRIMARY KEY\n- customerId INT",
            "input_format": "Use Customers and Orders.",
            "output_format": "Return one column named Customers.",
            "expected_output": "Customers\nRavi",
            "constraints": "Each order belongs to one customer. A customer with zero orders must appear once.",
            "examples": [
                {
                    "input": "Customers with one name missing from the Orders table.",
                    "output": "Customers\nRavi",
                    "explanation": "Ravi has no matching row in Orders.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT c.name AS Customers\nFROM Customers c;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT c.name AS Customers\nFROM Customers c\nLEFT JOIN Orders o ON o.customerId = c.id\nWHERE o.id IS NULL;",
                    "explanation": "A left join keeps all customers, and unmatched orders show up as NULL.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT name AS Customers\nFROM Customers\nWHERE id NOT IN (SELECT customerId FROM Orders);",
                    "explanation": "Exclude every customer id that appears in the Orders table.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Duplicate Emails",
            "slug": "sql-duplicate-emails",
            "difficulty": "easy",
            "category": "sql",
            "tags": ["sql", "group-by", "having"],
            "short_description": "Return email values that appear more than once.",
            "problem_statement": "Write an SQL query to find all duplicate email addresses.",
            "sql_schema": "Table: Person\n- id INT PRIMARY KEY\n- email VARCHAR(255)",
            "input_format": "Use the Person table.",
            "output_format": "Return one column named Email.",
            "expected_output": "Email\nadmin@example.com",
            "constraints": "Return each duplicate email only once.",
            "examples": [
                {
                    "input": "Person rows with repeated email values.",
                    "output": "Email\nadmin@example.com",
                    "explanation": "The email appears in more than one row.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT email AS Email\nFROM Person;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT email AS Email\nFROM Person\nGROUP BY email\nHAVING COUNT(*) > 1;",
                    "explanation": "Group by email and keep only groups with more than one row.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT DISTINCT p1.email AS Email\nFROM Person p1\nJOIN Person p2 ON p1.email = p2.email AND p1.id <> p2.id;",
                    "explanation": "Self-join matching emails from different rows and keep distinct duplicates.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Rising Temperature",
            "slug": "sql-rising-temperature",
            "difficulty": "medium",
            "category": "sql",
            "tags": ["sql", "date", "self-join"],
            "short_description": "Find dates where the temperature is higher than the previous day.",
            "problem_statement": "Write an SQL query to find all dates where the temperature was higher than the previous day.",
            "sql_schema": "Table: Weather\n- id INT PRIMARY KEY\n- recordDate DATE\n- temperature INT",
            "input_format": "Use the Weather table.",
            "output_format": "Return one column named Id.",
            "expected_output": "Id\n2\n4",
            "constraints": "Compare only with the immediate previous calendar day.",
            "examples": [
                {
                    "input": "Weather rows over consecutive dates.",
                    "output": "Id\n2",
                    "explanation": "The second day has a higher temperature than the first day.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT w.id AS Id\nFROM Weather w;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT w1.id AS Id\nFROM Weather w1\nJOIN Weather w2 ON DATEDIFF(w1.recordDate, w2.recordDate) = 1\nWHERE w1.temperature > w2.temperature;",
                    "explanation": "Join each row with the previous calendar day and compare temperatures.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT id AS Id\nFROM Weather w\nWHERE temperature > (\n    SELECT temperature\n    FROM Weather\n    WHERE recordDate = DATE_SUB(w.recordDate, INTERVAL 1 DAY)\n);",
                    "explanation": "Use a correlated subquery to fetch the previous day's temperature for each row.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Product Sales Analysis",
            "slug": "sql-product-sales-analysis",
            "difficulty": "medium",
            "category": "sql",
            "tags": ["sql", "join", "aggregation"],
            "short_description": "Report total revenue by product.",
            "problem_statement": "Write an SQL query to calculate total revenue for each product based on units sold and unit price.",
            "sql_schema": "Table: Product\n- product_id INT PRIMARY KEY\n- product_name VARCHAR(100)\n- price INT\n\nTable: Sales\n- sale_id INT PRIMARY KEY\n- product_id INT\n- units INT",
            "input_format": "Use Product and Sales.",
            "output_format": "Return columns product_name and revenue.",
            "expected_output": "product_name | revenue\nLaptop | 120000",
            "constraints": "Revenue is price multiplied by total units sold for that product.",
            "examples": [
                {
                    "input": "Sales rows joined to Product pricing.",
                    "output": "product_name | revenue\nLaptop | 120000",
                    "explanation": "Revenue sums all sold units multiplied by price.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT p.product_name, 0 AS revenue\nFROM Product p;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT p.product_name, SUM(p.price * s.units) AS revenue\nFROM Product p\nJOIN Sales s ON s.product_id = p.product_id\nGROUP BY p.product_id, p.product_name;",
                    "explanation": "Join product prices to sales and aggregate total price-times-units per product.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT p.product_name,\n       (SELECT SUM(p.price * s.units)\n        FROM Sales s\n        WHERE s.product_id = p.product_id) AS revenue\nFROM Product p;",
                    "explanation": "Compute revenue per product using a correlated aggregate subquery.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Monthly Transaction Totals",
            "slug": "sql-monthly-transaction-totals",
            "difficulty": "medium",
            "category": "sql",
            "tags": ["sql", "group-by", "date"],
            "short_description": "Summarize transaction volume and amount by month.",
            "problem_statement": "Write an SQL query to return the total number of transactions and total amount for each month.",
            "sql_schema": "Table: Transactions\n- id INT PRIMARY KEY\n- trans_date DATE\n- amount DECIMAL(10,2)\n- state VARCHAR(20)",
            "input_format": "Use the Transactions table.",
            "output_format": "Return columns month, transaction_count, total_amount.",
            "expected_output": "month | transaction_count | total_amount\n2026-01 | 4 | 920.00",
            "constraints": "Group all rows by calendar month in YYYY-MM format.",
            "examples": [
                {
                    "input": "Transactions recorded across different dates in the same month.",
                    "output": "month | transaction_count | total_amount\n2026-01 | 4 | 920.00",
                    "explanation": "All January transactions are grouped together.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT '' AS month, 0 AS transaction_count, 0 AS total_amount;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT DATE_FORMAT(trans_date, '%Y-%m') AS month,\n       COUNT(*) AS transaction_count,\n       SUM(amount) AS total_amount\nFROM Transactions\nGROUP BY DATE_FORMAT(trans_date, '%Y-%m')\nORDER BY month;",
                    "explanation": "Format each date into a month bucket, then aggregate count and amount.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT month_bucket.month,\n       COUNT(t.id) AS transaction_count,\n       SUM(t.amount) AS total_amount\nFROM (\n    SELECT DISTINCT DATE_FORMAT(trans_date, '%Y-%m') AS month\n    FROM Transactions\n) month_bucket\nJOIN Transactions t ON DATE_FORMAT(t.trans_date, '%Y-%m') = month_bucket.month\nGROUP BY month_bucket.month\nORDER BY month_bucket.month;",
                    "explanation": "Build the month buckets first, then join transactions back into each bucket.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Managers With At Least Five Reports",
            "slug": "sql-managers-with-five-reports",
            "difficulty": "medium",
            "category": "sql",
            "tags": ["sql", "self-join", "group-by"],
            "short_description": "Find managers who supervise at least five employees.",
            "problem_statement": "Write an SQL query to report the names of managers who have at least five direct reports.",
            "sql_schema": "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- department VARCHAR(100)\n- managerId INT",
            "input_format": "Use the Employee table.",
            "output_format": "Return one column named name.",
            "expected_output": "name\nSonia",
            "constraints": "Count only direct reports, not indirect hierarchy levels.",
            "examples": [
                {
                    "input": "Employee rows where one manager id appears at least five times.",
                    "output": "name\nSonia",
                    "explanation": "Sonia is the manager with five direct reports.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT e.name\nFROM Employee e;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT m.name\nFROM Employee m\nJOIN Employee e ON e.managerId = m.id\nGROUP BY m.id, m.name\nHAVING COUNT(*) >= 5;",
                    "explanation": "Join employees to their managers and keep only managers with at least five reports.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT name\nFROM Employee m\nWHERE (\n    SELECT COUNT(*)\n    FROM Employee e\n    WHERE e.managerId = m.id\n) >= 5;",
                    "explanation": "Count direct reports for each employee and keep those with counts of five or more.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Top Customer by Orders",
            "slug": "sql-top-customer-by-orders",
            "difficulty": "easy",
            "category": "sql",
            "tags": ["sql", "join", "order-by"],
            "short_description": "Find the customer with the most orders.",
            "problem_statement": "Write an SQL query to find the customer who placed the highest number of orders.",
            "sql_schema": "Table: Customers\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n\nTable: Orders\n- id INT PRIMARY KEY\n- customer_id INT\n- order_date DATE",
            "input_format": "Use Customers and Orders.",
            "output_format": "Return columns customer_name and order_count.",
            "expected_output": "customer_name | order_count\nAsha | 12",
            "constraints": "If multiple customers tie, return all of them.",
            "examples": [
                {
                    "input": "Orders linked to several customers.",
                    "output": "customer_name | order_count\nAsha | 12",
                    "explanation": "Asha placed the greatest number of orders.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT c.name AS customer_name, COUNT(o.id) AS order_count\nFROM Customers c\nLEFT JOIN Orders o ON o.customer_id = c.id\nGROUP BY c.id, c.name;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "WITH order_counts AS (\n    SELECT c.name AS customer_name, COUNT(o.id) AS order_count\n    FROM Customers c\n    JOIN Orders o ON o.customer_id = c.id\n    GROUP BY c.id, c.name\n)\nSELECT customer_name, order_count\nFROM order_counts\nWHERE order_count = (SELECT MAX(order_count) FROM order_counts);",
                    "explanation": "Count orders per customer, then keep only the rows tied for the maximum count.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT c.name AS customer_name, COUNT(o.id) AS order_count\nFROM Customers c\nJOIN Orders o ON o.customer_id = c.id\nGROUP BY c.id, c.name\nHAVING COUNT(o.id) >= ALL (\n    SELECT COUNT(*)\n    FROM Orders\n    GROUP BY customer_id\n);",
                    "explanation": "Compare each customer's order count against all grouped counts and keep the largest.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Employees Earning More Than Their Manager",
            "slug": "sql-employees-earning-more-than-manager",
            "difficulty": "easy",
            "category": "sql",
            "tags": ["sql", "self-join", "comparison"],
            "short_description": "Find employees whose salary exceeds their manager's salary.",
            "problem_statement": "Write an SQL query to find employees who earn strictly more than their direct manager.",
            "sql_schema": "Table: Employee\n- id INT PRIMARY KEY\n- name VARCHAR(100)\n- salary INT\n- managerId INT",
            "input_format": "Use the Employee table.",
            "output_format": "Return one column named Employee.",
            "expected_output": "Employee\nRitu",
            "constraints": "Only compare an employee with their direct manager.",
            "examples": [
                {
                    "input": "Employee rows with manager references and salary values.",
                    "output": "Employee\nRitu",
                    "explanation": "Ritu's salary is greater than her manager's salary.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT e.name AS Employee\nFROM Employee e;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT e.name AS Employee\nFROM Employee e\nJOIN Employee m ON e.managerId = m.id\nWHERE e.salary > m.salary;",
                    "explanation": "Self-join employees to their managers and compare salaries directly.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT name AS Employee\nFROM Employee e\nWHERE salary > (\n    SELECT m.salary\n    FROM Employee m\n    WHERE m.id = e.managerId\n);",
                    "explanation": "Use a correlated subquery to fetch the manager salary for each employee.",
                    "approach_type": "brute_force",
                },
            ],
        },
        {
            "title": "Daily Active Users",
            "slug": "sql-daily-active-users",
            "difficulty": "medium",
            "category": "sql",
            "tags": ["sql", "group-by", "distinct"],
            "short_description": "Count distinct users active on each day.",
            "problem_statement": "Write an SQL query to return the number of distinct active users for each activity date.",
            "sql_schema": "Table: Activity\n- user_id INT\n- session_id INT\n- activity_date DATE\n- activity_type VARCHAR(50)",
            "input_format": "Use the Activity table.",
            "output_format": "Return columns activity_date and active_users.",
            "expected_output": "activity_date | active_users\n2026-04-01 | 18",
            "constraints": "Count each user only once per day even if they have multiple sessions.",
            "examples": [
                {
                    "input": "Activity rows with repeated sessions for the same user on one date.",
                    "output": "activity_date | active_users\n2026-04-01 | 18",
                    "explanation": "Distinct users are counted once per day.",
                }
            ],
            "starter_codes": [{"language": "sql", "code": "SELECT activity_date, COUNT(DISTINCT user_id) AS active_users\nFROM Activity\nGROUP BY activity_date;"}],
            "solutions": [
                {
                    "language": "sql",
                    "code": "SELECT activity_date, COUNT(DISTINCT user_id) AS active_users\nFROM Activity\nGROUP BY activity_date\nORDER BY activity_date;",
                    "explanation": "Group by date and count distinct user ids inside each day.",
                    "approach_type": "optimized",
                },
                {
                    "language": "sql",
                    "code": "SELECT dates.activity_date,\n       (SELECT COUNT(DISTINCT a.user_id)\n        FROM Activity a\n        WHERE a.activity_date = dates.activity_date) AS active_users\nFROM (SELECT DISTINCT activity_date FROM Activity) dates\nORDER BY dates.activity_date;",
                    "explanation": "Build each date bucket first and then count distinct users in a correlated subquery.",
                    "approach_type": "brute_force",
                },
            ],
        },
    ]

    default_starter = """def solve(*args):
    # implement your solution here
    pass"""

    session = SessionLocal()
    try:
        existing_questions = {question.slug: question for question in session.query(Question).all()}

        def _create_question(template: dict) -> None:
            category = template.get("category", "coding")
            question = Question(
                title=template["title"],
                slug=template["slug"],
                difficulty=DifficultyLevel[template.get("difficulty", "easy")],
                category=QuestionCategory[category],
                tags=template.get("tags", []),
                problem_statement=(
                    build_sql_problem_statement(template)
                    if category == "sql"
                    else build_detailed_problem_statement(template)
                ),
                short_description=template.get("short_description", ""),
                diagram_url=template.get("diagram_url"),
                diagram_caption=template.get("diagram_caption"),
                input_format=template.get("input_format", ""),
                output_format=template.get("output_format", ""),
                sql_schema=template.get("sql_schema", ""),
                expected_output=template.get("expected_output", ""),
                sample_tables=template.get("sample_tables", []),
                function_signature=template.get("function_signature", "def solve(*args):"),
                constraints=template.get("constraints", ""),
                time_limit=template.get("time_limit", 1),
                memory_limit=template.get("memory_limit", 256),
                points=template.get("points", 10),
                visibility=QuestionVisibility.published,
                created_by=1,
            )
            session.add(question)
            session.flush()

            for example in template.get("examples", []):
                session.add(
                    Example(
                        question_id=question.id,
                        input=example["input"],
                        output=example["output"],
                        explanation=example.get("explanation"),
                    )
                )

            for test_case in template.get("test_cases", []):
                session.add(
                    TestCase(
                        question_id=question.id,
                        input=test_case["input"],
                        output=test_case["output"],
                        is_hidden=test_case.get("is_hidden", False),
                    )
                )

            for starter in template.get("starter_codes", []):
                language = ProgrammingLanguage[starter["language"]]
                session.add(
                    StarterCode(
                        question_id=question.id,
                        language=language,
                        code=starter["code"],
                    )
                )

            for solution in template.get("solutions", get_seed_solutions(template)):
                session.add(
                    Solution(
                        question_id=question.id,
                        language=ProgrammingLanguage[solution.get("language", "python")],
                        code=solution["code"],
                        explanation=solution["explanation"],
                        approach_type=ApproachType[solution.get("approach_type", "optimized")],
                    )
                )
            session.flush()

        for template in question_templates:
            existing_question = existing_questions.get(template["slug"])
            if existing_question:
                if not existing_question.starter_codes:
                    for starter in template.get("starter_codes", [{"language": "python", "code": default_starter}]):
                        session.add(
                            StarterCode(
                                question_id=existing_question.id,
                                language=ProgrammingLanguage[starter["language"]],
                                code=starter["code"],
                            )
                        )
                if not existing_question.problem_statement or len(existing_question.problem_statement.splitlines()) < 10:
                    existing_question.problem_statement = (
                        build_sql_problem_statement(template)
                        if template.get("category") == "sql"
                        else build_detailed_problem_statement(template)
                    )
                if not existing_question.diagram_url and template.get("diagram_url"):
                    existing_question.diagram_url = template.get("diagram_url")
                    existing_question.diagram_caption = template.get("diagram_caption")
                if not existing_question.sql_schema and template.get("sql_schema"):
                    existing_question.sql_schema = template.get("sql_schema")
                if not existing_question.expected_output and template.get("expected_output"):
                    existing_question.expected_output = template.get("expected_output")
                if not existing_question.sample_tables and template.get("sample_tables"):
                    existing_question.sample_tables = template.get("sample_tables")
                seeded_solutions = template.get("solutions", get_seed_solutions(template))
                existing_by_language = {
                    str(solution.language.value if hasattr(solution.language, "value") else solution.language): solution
                    for solution in existing_question.solutions
                }
                existing_solution_codes = [solution.code for solution in existing_question.solutions]
                has_only_placeholder_solutions = (
                    existing_question.solutions
                    and all(
                        "Reference solution placeholder" in code
                        or "Review algorithm and complete native" in code
                        for code in existing_solution_codes
                    )
                )
                if not existing_question.solutions or has_only_placeholder_solutions:
                    session.query(Solution).filter(Solution.question_id == existing_question.id).delete()
                    for solution in seeded_solutions:
                        session.add(
                            Solution(
                                question_id=existing_question.id,
                                language=ProgrammingLanguage[solution.get("language", "python")],
                                code=solution["code"],
                                explanation=solution["explanation"],
                                approach_type=ApproachType[solution.get("approach_type", "optimized")],
                            )
                        )
                else:
                    for solution in seeded_solutions:
                        language_key = solution.get("language", "python")
                        existing_solution = existing_by_language.get(language_key)
                        if not existing_solution:
                            session.add(
                                Solution(
                                    question_id=existing_question.id,
                                    language=ProgrammingLanguage[language_key],
                                    code=solution["code"],
                                    explanation=solution["explanation"],
                                    approach_type=ApproachType[solution.get("approach_type", "optimized")],
                                )
                            )
                            continue
                        if (
                            "Reference solution placeholder" in existing_solution.code
                            or "Review algorithm and complete native" in existing_solution.code
                        ):
                            existing_solution.code = solution["code"]
                            existing_solution.explanation = solution["explanation"]
                            existing_solution.approach_type = ApproachType[solution.get("approach_type", "optimized")]
                continue
            _create_question(
                {
                    **template,
                    "starter_codes": template.get(
                        "starter_codes",
                        [{"language": "sql", "code": "SELECT *\nFROM your_table;"}]
                        if template.get("category") == "sql"
                        else [{"language": "python", "code": default_starter}],
                    ),
                }
            )

        for template in sql_question_templates:
            template.setdefault("sample_tables", sql_sample_tables.get(template["slug"], []))
            existing_question = existing_questions.get(template["slug"])
            if existing_question:
                if not existing_question.problem_statement or len(existing_question.problem_statement.splitlines()) < 10:
                    existing_question.problem_statement = build_sql_problem_statement(template)
                if not existing_question.sql_schema:
                    existing_question.sql_schema = template.get("sql_schema", "")
                if not existing_question.expected_output:
                    existing_question.expected_output = template.get("expected_output", "")
                if not existing_question.sample_tables:
                    existing_question.sample_tables = template.get("sample_tables", [])
                if not existing_question.starter_codes:
                    for starter in template.get("starter_codes", [{"language": "sql", "code": "SELECT *\nFROM your_table;"}]):
                        session.add(
                            StarterCode(
                                question_id=existing_question.id,
                                language=ProgrammingLanguage[starter["language"]],
                                code=starter["code"],
                            )
                        )
                existing_by_language = {
                    str(solution.language.value if hasattr(solution.language, "value") else solution.language): solution
                    for solution in existing_question.solutions
                }
                for solution in template.get("solutions", []):
                    language_key = solution.get("language", "sql")
                    if language_key not in existing_by_language:
                        session.add(
                            Solution(
                                question_id=existing_question.id,
                                language=ProgrammingLanguage[language_key],
                                code=solution["code"],
                                explanation=solution["explanation"],
                                approach_type=ApproachType[solution.get("approach_type", "optimized")],
                            )
                        )
                continue
            _create_question(template)

        session.commit()
    except Exception:  # pragma: no cover
        session.rollback()
    finally:
        session.close()


reset_database(drop_existing=False)
