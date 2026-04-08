import sys
from pathlib import Path

from slugify import slugify

BASE = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE / "backend"))

from app.db import SessionLocal
from app.models.practice_arena import (
    Question,
    Example,
    TestCase,
    StarterCode,
    DifficultyLevel,
    QuestionCategory,
    QuestionVisibility,
    ProgrammingLanguage,
)


def create_sample_question():
    session = SessionLocal()
    title = "Two Sum Closest"
    print(f"Ensuring question {title!r} exists ...")
    try:
        slug = slugify(title)
        existing = session.query(Question).filter(Question.slug == slug).first()
        if existing:
            print("Question already exists, skipping.")
            return

        question = Question(
            title=title,
            slug=slug,
            difficulty=DifficultyLevel.medium,
            category=QuestionCategory.coding,
            tags=["array", "two-pointers", "sorting"],
            problem_statement=(
                "You are given an integer array nums and an integer target. "
                "Your task is to find two distinct elements in the array such "
                "that their sum is closest to the target value."
            ),
            short_description=(
                "Return the sum of those two elements. If there are multiple "
                "pairs with the same closest difference, return any one of them."
            ),
            input_format="nums: list of integers\n target: integer",
            output_format="Integer representing the sum closest to target",
            constraints="2 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4\n-10^4 <= target <= 10^4",
            function_signature="def solve(nums: list[int], target: int) -> int:",
            time_limit=1,
            memory_limit=256,
            points=20,
            visibility=QuestionVisibility.published,
            created_by=4,
        )
        session.add(question)
        session.flush()

        session.add_all(
            [
                Example(
                    question_id=question.id,
                    input="[1, 2, 3, 4]\n10",
                    output="7",
                    explanation="1 + 6 is optimal, but 3 + 4 is closest to 10.",
                ),
                Example(
                    question_id=question.id,
                    input="[5, 2, 7, 11]\n13",
                    output="13",
                    explanation="5 + 8 doesn't exist; best is 5 + 7.",
                ),
            ]
        )

        session.add_all(
            [
                TestCase(question_id=question.id, input="[1,2]\n3", output="3", is_hidden=False),
                TestCase(question_id=question.id, input="[10,20,30]\n50", output="50", is_hidden=False),
                TestCase(question_id=question.id, input="[8,8,8,8]\n16", output="16", is_hidden=True),
            ]
        )

        session.add_all(
            [
                StarterCode(
                    question_id=question.id,
                    language=ProgrammingLanguage.python,
                    code=(
                        "def solve(nums, target):\n"
                        "    nums.sort()\n"
                        "    left, right = 0, len(nums) - 1\n"
                        "    closest_sum = float('inf')\n"
                        "    while left < right:\n"
                        "        current_sum = nums[left] + nums[right]\n"
                        "        if abs(target - current_sum) < abs(target - closest_sum):\n"
                        "            closest_sum = current_sum\n"
                        "        if current_sum < target:\n"
                        "            left += 1\n"
                        "        else:\n"
                        "            right -= 1\n"
                        "    return closest_sum\n"
                    ),
                )
            ]
        )

        session.commit()
        print("Question inserted successfully.")
    except Exception as exc:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    create_sample_question()
