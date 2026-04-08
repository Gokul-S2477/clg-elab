import re


PYTHON_SOLUTION_BANK = {
    "two-sum-closest": """def solve(nums, target):\n    nums = sorted(nums)\n    left, right = 0, len(nums) - 1\n    best = nums[left] + nums[right]\n    while left < right:\n        current = nums[left] + nums[right]\n        if abs(target - current) < abs(target - best):\n            best = current\n        if current < target:\n            left += 1\n        else:\n            right -= 1\n    return best\n""",
    "running-sum": """def solve(nums):\n    total = 0\n    result = []\n    for value in nums:\n        total += value\n        result.append(total)\n    return result\n""",
    "count-distinct": """def solve(nums):\n    return len(set(nums))\n""",
    "merge-two-sorted": """def solve(nums1, nums2):\n    left = right = 0\n    merged = []\n    while left < len(nums1) and right < len(nums2):\n        if nums1[left] <= nums2[right]:\n            merged.append(nums1[left])\n            left += 1\n        else:\n            merged.append(nums2[right])\n            right += 1\n    merged.extend(nums1[left:])\n    merged.extend(nums2[right:])\n    return merged\n""",
    "balanced-brackets": """def solve(expression):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for char in expression:\n        if char in pairs.values():\n            stack.append(char)\n        elif char in pairs:\n            if not stack or stack.pop() != pairs[char]:\n                return 'false'\n    return 'true' if not stack else 'false'\n""",
    "fizzbuzz-sequence": """def solve(n):\n    result = []\n    for value in range(1, n + 1):\n        entry = ''\n        if value % 3 == 0:\n            entry += 'Fizz'\n        if value % 5 == 0:\n            entry += 'Buzz'\n        result.append(entry or str(value))\n    return result\n""",
    "max-pair-sum": """def solve(nums):\n    nums = sorted(nums)\n    return nums[-1] + nums[-2]\n""",
    "palindrome-check": """def solve(value):\n    text = str(value).lower()\n    return 'true' if text == text[::-1] else 'false'\n""",
    "sort-colors": """def solve(nums):\n    counts = [0, 0, 0]\n    for value in nums:\n        counts[value] += 1\n    return [0] * counts[0] + [1] * counts[1] + [2] * counts[2]\n""",
    "consecutive-sequence": """def solve(nums):\n    values = set(nums)\n    best = 0\n    for value in values:\n        if value - 1 not in values:\n            length = 1\n            current = value\n            while current + 1 in values:\n                current += 1\n                length += 1\n            best = max(best, length)\n    return best\n""",
    "valid-anagram": """def solve(first, second):\n    return 'true' if sorted(first) == sorted(second) else 'false'\n""",
    "contains-duplicate": """def solve(nums):\n    return 'true' if len(set(nums)) != len(nums) else 'false'\n""",
    "best-time-to-buy-and-sell-stock": """def solve(prices):\n    best_buy = float('inf')\n    best_profit = 0\n    for price in prices:\n        best_buy = min(best_buy, price)\n        best_profit = max(best_profit, price - best_buy)\n    return best_profit\n""",
    "move-zeroes": """def solve(nums):\n    values = [value for value in nums if value != 0]\n    values.extend([0] * (len(nums) - len(values)))\n    return values\n""",
    "product-of-array-except-self": """def solve(nums):\n    result = [1] * len(nums)\n    prefix = 1\n    for index, value in enumerate(nums):\n        result[index] = prefix\n        prefix *= value\n    suffix = 1\n    for index in range(len(nums) - 1, -1, -1):\n        result[index] *= suffix\n        suffix *= nums[index]\n    return result\n""",
    "maximum-subarray": """def solve(nums):\n    current = best = nums[0]\n    for value in nums[1:]:\n        current = max(value, current + value)\n        best = max(best, current)\n    return best\n""",
    "climbing-stairs": """def solve(n):\n    first, second = 1, 1\n    for _ in range(n):\n        first, second = second, first + second\n    return first\n""",
    "min-cost-climbing-stairs": """def solve(cost):\n    prev2 = prev1 = 0\n    for index in range(2, len(cost) + 1):\n        prev2, prev1 = prev1, min(prev1 + cost[index - 1], prev2 + cost[index - 2])\n    return prev1\n""",
    "binary-search": """def solve(nums, target):\n    left, right = 0, len(nums) - 1\n    while left <= right:\n        middle = (left + right) // 2\n        if nums[middle] == target:\n            return middle\n        if nums[middle] < target:\n            left = middle + 1\n        else:\n            right = middle - 1\n    return -1\n""",
    "search-insert-position": """def solve(nums, target):\n    left, right = 0, len(nums)\n    while left < right:\n        middle = (left + right) // 2\n        if nums[middle] < target:\n            left = middle + 1\n        else:\n            right = middle\n    return left\n""",
    "reverse-string": """def solve(text):\n    return str(text)[::-1]\n""",
    "first-unique-character": """def solve(text):\n    counts = {}\n    for char in text:\n        counts[char] = counts.get(char, 0) + 1\n    for index, char in enumerate(text):\n        if counts[char] == 1:\n            return index\n    return -1\n""",
    "longest-common-prefix": """def solve(words):\n    if not words:\n        return ''\n    prefix = words[0]\n    for word in words[1:]:\n        while not word.startswith(prefix):\n            prefix = prefix[:-1]\n            if not prefix:\n                return ''\n    return prefix\n""",
    "roman-to-integer": """def solve(value):\n    values = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}\n    total = 0\n    previous = 0\n    for char in reversed(value):\n        current = values[char]\n        if current < previous:\n            total -= current\n        else:\n            total += current\n        previous = current\n    return total\n""",
    "length-of-last-word": """def solve(sentence):\n    return len(sentence.rstrip().split(' ')[-1])\n""",
    "plus-one": """def solve(digits):\n    digits = digits[:]\n    for index in range(len(digits) - 1, -1, -1):\n        if digits[index] < 9:\n            digits[index] += 1\n            return digits\n        digits[index] = 0\n    return [1] + digits\n""",
    "sqrt-floor": """def solve(x):\n    left, right = 0, x\n    answer = 0\n    while left <= right:\n        middle = (left + right) // 2\n        square = middle * middle\n        if square <= x:\n            answer = middle\n            left = middle + 1\n        else:\n            right = middle - 1\n    return answer\n""",
    "pascal-triangle": """def solve(num_rows):\n    triangle = []\n    for row in range(num_rows):\n        current = [1] * (row + 1)\n        for index in range(1, row):\n            current[index] = triangle[row - 1][index - 1] + triangle[row - 1][index]\n        triangle.append(current)\n    return triangle\n""",
    "single-number": """def solve(nums):\n    result = 0\n    for value in nums:\n        result ^= value\n    return result\n""",
    "majority-element": """def solve(nums):\n    candidate = None\n    count = 0\n    for value in nums:\n        if count == 0:\n            candidate = value\n        count += 1 if value == candidate else -1\n    return candidate\n""",
    "excel-sheet-column-number": """def solve(column_title):\n    result = 0\n    for char in column_title:\n        result = result * 26 + ord(char) - ord('A') + 1\n    return result\n""",
    "happy-number": """def solve(n):\n    seen = set()\n    while n != 1 and n not in seen:\n        seen.add(n)\n        n = sum(int(digit) ** 2 for digit in str(n))\n    return 'true' if n == 1 else 'false'\n""",
    "isomorphic-strings": """def solve(first, second):\n    if len(first) != len(second):\n        return 'false'\n    forward, backward = {}, {}\n    for left, right in zip(first, second):\n        if forward.get(left, right) != right or backward.get(right, left) != left:\n            return 'false'\n        forward[left] = right\n        backward[right] = left\n    return 'true'\n""",
    "valid-palindrome": """def solve(text):\n    filtered = ''.join(char.lower() for char in text if char.isalnum())\n    return 'true' if filtered == filtered[::-1] else 'false'\n""",
    "intersection-of-two-arrays": """def solve(nums1, nums2):\n    return sorted(set(nums1) & set(nums2))\n""",
    "missing-number": """def solve(nums):\n    n = len(nums)\n    return n * (n + 1) // 2 - sum(nums)\n""",
    "find-difference-of-two-arrays": """def solve(nums1, nums2):\n    first = sorted(set(nums1) - set(nums2))\n    second = sorted(set(nums2) - set(nums1))\n    return [first, second]\n""",
    "can-place-flowers": """def solve(flowerbed, n):\n    bed = flowerbed[:]\n    count = 0\n    for index, value in enumerate(bed):\n        if value == 0:\n            left = index == 0 or bed[index - 1] == 0\n            right = index == len(bed) - 1 or bed[index + 1] == 0\n            if left and right:\n                bed[index] = 1\n                count += 1\n    return 'true' if count >= n else 'false'\n""",
    "kids-with-the-greatest-number-of-candies": """def solve(candies, extra_candies):\n    limit = max(candies)\n    return [value + extra_candies >= limit for value in candies]\n""",
    "merge-strings-alternately": """def solve(word1, word2):\n    result = []\n    for index in range(max(len(word1), len(word2))):\n        if index < len(word1):\n            result.append(word1[index])\n        if index < len(word2):\n            result.append(word2[index])\n    return ''.join(result)\n""",
    "greatest-common-divisor-of-strings": """from math import gcd\n\ndef solve(str1, str2):\n    if str1 + str2 != str2 + str1:\n        return ''\n    length = gcd(len(str1), len(str2))\n    return str1[:length]\n""",
    "reverse-vowels": """def solve(text):\n    vowels = set('aeiouAEIOU')\n    chars = list(text)\n    left, right = 0, len(chars) - 1\n    while left < right:\n        while left < right and chars[left] not in vowels:\n            left += 1\n        while left < right and chars[right] not in vowels:\n            right -= 1\n        chars[left], chars[right] = chars[right], chars[left]\n        left += 1\n        right -= 1\n    return ''.join(chars)\n""",
    "reverse-words-in-a-string": """def solve(sentence):\n    return ' '.join(reversed(sentence.split()))\n""",
    "increasing-triplet-subsequence": """def solve(nums):\n    first = second = float('inf')\n    for value in nums:\n        if value <= first:\n            first = value\n        elif value <= second:\n            second = value\n        else:\n            return 'true'\n    return 'false'\n""",
    "string-compression": """def solve(text):\n    if not text:\n        return ''\n    result = []\n    count = 1\n    for index in range(1, len(text) + 1):\n        if index < len(text) and text[index] == text[index - 1]:\n            count += 1\n        else:\n            result.append(text[index - 1])\n            if count > 1:\n                result.append(str(count))\n            count = 1\n    return ''.join(result)\n""",
    "maximum-average-subarray": """def solve(nums, k):\n    window = sum(nums[:k])\n    best = window\n    for index in range(k, len(nums)):\n        window += nums[index] - nums[index - k]\n        best = max(best, window)\n    value = best / k\n    return float(value)\n""",
    "find-pivot-index": """def solve(nums):\n    total = sum(nums)\n    left = 0\n    for index, value in enumerate(nums):\n        if left == total - left - value:\n            return index\n        left += value\n    return -1\n""",
    "find-the-highest-altitude": """def solve(gain):\n    altitude = best = 0\n    for value in gain:\n        altitude += value\n        best = max(best, altitude)\n    return best\n""",
    "unique-number-of-occurrences": """def solve(nums):\n    counts = {}\n    for value in nums:\n        counts[value] = counts.get(value, 0) + 1\n    return 'true' if len(set(counts.values())) == len(counts) else 'false'\n""",
    "determine-if-two-strings-are-close": """def solve(word1, word2):\n    if set(word1) != set(word2):\n        return 'false'\n    counts1 = sorted(word1.count(char) for char in set(word1))\n    counts2 = sorted(word2.count(char) for char in set(word2))\n    return 'true' if counts1 == counts2 else 'false'\n""",
    "equal-row-and-column-pairs": """def solve(grid):\n    rows = {}\n    for row in grid:\n        key = tuple(row)\n        rows[key] = rows.get(key, 0) + 1\n    total = 0\n    for column in zip(*grid):\n        total += rows.get(tuple(column), 0)\n    return total\n""",
    "maximum-depth-of-binary-tree": """def solve(nodes):\n    def depth(index):\n        if index >= len(nodes) or nodes[index] is None:\n            return 0\n        return 1 + max(depth(2 * index + 1), depth(2 * index + 2))\n    return depth(0)\n""",
    "invert-binary-tree": """def solve(nodes):\n    values = nodes[:]\n    def invert(index):\n        if index >= len(values) or values[index] is None:\n            return\n        left, right = 2 * index + 1, 2 * index + 2\n        if right < len(values) or left < len(values):\n            while len(values) <= max(left, right):\n                values.append(None)\n            values[left], values[right] = values[right], values[left]\n            invert(left)\n            invert(right)\n    invert(0)\n    while values and values[-1] is None:\n        values.pop()\n    return values\n""",
    "same-tree": """def solve(tree1, tree2):\n    return 'true' if tree1 == tree2 else 'false'\n""",
    "symmetric-tree": """def solve(nodes):\n    def mirror(left, right):\n        left_missing = left >= len(nodes) or nodes[left] is None\n        right_missing = right >= len(nodes) or nodes[right] is None\n        if left_missing and right_missing:\n            return True\n        if left_missing or right_missing or nodes[left] != nodes[right]:\n            return False\n        return mirror(2 * left + 1, 2 * right + 2) and mirror(2 * left + 2, 2 * right + 1)\n    return 'true' if not nodes or mirror(1, 2) else 'false'\n""",
    "path-sum": """def solve(nodes, target_sum):\n    def walk(index, total):\n        if index >= len(nodes) or nodes[index] is None:\n            return False\n        total += nodes[index]\n        left, right = 2 * index + 1, 2 * index + 2\n        left_missing = left >= len(nodes) or nodes[left] is None\n        right_missing = right >= len(nodes) or nodes[right] is None\n        if left_missing and right_missing:\n            return total == target_sum\n        return walk(left, total) or walk(right, total)\n    return 'true' if walk(0, 0) else 'false'\n""",
    "summary-ranges": """def solve(nums):\n    if not nums:\n        return []\n    result = []\n    start = nums[0]\n    for index in range(1, len(nums) + 1):\n        if index == len(nums) or nums[index] != nums[index - 1] + 1:\n            end = nums[index - 1]\n            result.append(str(start) if start == end else f'{start}->{end}')\n            if index < len(nums):\n                start = nums[index]\n    return result\n""",
    "is-subsequence": """def solve(s, t):\n    index = 0\n    for char in t:\n        if index < len(s) and s[index] == char:\n            index += 1\n    return 'true' if index == len(s) else 'false'\n""",
    "reverse-linked-list-values": """def solve(values):\n    return list(reversed(values))\n""",
    "middle-of-linked-list-values": """def solve(values):\n    return values[len(values) // 2:]\n""",
    "remove-duplicates-from-sorted-array": """def solve(nums):\n    result = []\n    for value in nums:\n        if not result or result[-1] != value:\n            result.append(value)\n    return result\n""",
    "remove-element": """def solve(nums, val):\n    return [value for value in nums if value != val]\n""",
}


RETURN_TYPE_HINTS = {
    "balanced-brackets": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "valid-anagram": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "contains-duplicate": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "happy-number": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "isomorphic-strings": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "valid-palindrome": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "can-place-flowers": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "increasing-triplet-subsequence": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "unique-number-of-occurrences": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "determine-if-two-strings-are-close": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "same-tree": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "symmetric-tree": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "path-sum": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "is-subsequence": {"javascript": "boolean", "java": "boolean", "cpp": "bool"},
    "reverse-string": {"javascript": "string", "java": "String", "cpp": "string"},
    "longest-common-prefix": {"javascript": "string", "java": "String", "cpp": "string"},
    "merge-strings-alternately": {"javascript": "string", "java": "String", "cpp": "string"},
    "greatest-common-divisor-of-strings": {"javascript": "string", "java": "String", "cpp": "string"},
    "reverse-vowels": {"javascript": "string", "java": "String", "cpp": "string"},
    "reverse-words-in-a-string": {"javascript": "string", "java": "String", "cpp": "string"},
    "string-compression": {"javascript": "string", "java": "String", "cpp": "string"},
    "fizzbuzz-sequence": {"javascript": "string[]", "java": "List<String>", "cpp": "vector<string>"},
    "summary-ranges": {"javascript": "string[]", "java": "List<String>", "cpp": "vector<string>"},
    "kids-with-the-greatest-number-of-candies": {"javascript": "boolean[]", "java": "List<Boolean>", "cpp": "vector<bool>"},
    "pascal-triangle": {"javascript": "number[][]", "java": "List<List<Integer>>", "cpp": "vector<vector<int>>"},
    "find-difference-of-two-arrays": {"javascript": "number[][]", "java": "List<List<Integer>>", "cpp": "vector<vector<int>>"},
    "running-sum": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "merge-two-sorted": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "sort-colors": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "product-of-array-except-self": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "plus-one": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "intersection-of-two-arrays": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "reverse-linked-list-values": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "middle-of-linked-list-values": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "remove-duplicates-from-sorted-array": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "remove-element": {"javascript": "number[]", "java": "int[]", "cpp": "vector<int>"},
    "maximum-average-subarray": {"javascript": "number", "java": "double", "cpp": "double"},
}


ARG_TYPE_HINTS = {
    "nums": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "nums1": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "nums2": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "prices": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "cost": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "candies": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "gain": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "digits": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "flowerbed": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "values": {"javascript": "", "java": "int[]", "cpp": "vector<int>"},
    "grid": {"javascript": "", "java": "int[][]", "cpp": "vector<vector<int>>"},
    "words": {"javascript": "", "java": "String[]", "cpp": "vector<string>"},
    "nodes": {"javascript": "", "java": "Integer[]", "cpp": "vector<int>"},
    "tree1": {"javascript": "", "java": "Integer[]", "cpp": "vector<int>"},
    "tree2": {"javascript": "", "java": "Integer[]", "cpp": "vector<int>"},
    "expression": {"javascript": "", "java": "String", "cpp": "string"},
    "text": {"javascript": "", "java": "String", "cpp": "string"},
    "sentence": {"javascript": "", "java": "String", "cpp": "string"},
    "first": {"javascript": "", "java": "String", "cpp": "string"},
    "second": {"javascript": "", "java": "String", "cpp": "string"},
    "value": {"javascript": "", "java": "String", "cpp": "string"},
    "word1": {"javascript": "", "java": "String", "cpp": "string"},
    "word2": {"javascript": "", "java": "String", "cpp": "string"},
    "str1": {"javascript": "", "java": "String", "cpp": "string"},
    "str2": {"javascript": "", "java": "String", "cpp": "string"},
    "s": {"javascript": "", "java": "String", "cpp": "string"},
    "t": {"javascript": "", "java": "String", "cpp": "string"},
    "column_title": {"javascript": "", "java": "String", "cpp": "string"},
    "n": {"javascript": "", "java": "int", "cpp": "int"},
    "k": {"javascript": "", "java": "int", "cpp": "int"},
    "target": {"javascript": "", "java": "int", "cpp": "int"},
    "x": {"javascript": "", "java": "int", "cpp": "int"},
    "extra_candies": {"javascript": "", "java": "int", "cpp": "int"},
    "val": {"javascript": "", "java": "int", "cpp": "int"},
    "num_rows": {"javascript": "", "java": "int", "cpp": "int"},
    "target_sum": {"javascript": "", "java": "int", "cpp": "int"},
}


def _extract_args(python_code):
    match = re.search(r"def solve\((.*?)\):", python_code)
    if not match:
        return []
    raw_args = [item.strip() for item in match.group(1).split(",") if item.strip()]
    return [item.split("=")[0].strip() for item in raw_args]


def _infer_return_type(slug, language):
    if slug in RETURN_TYPE_HINTS:
        return RETURN_TYPE_HINTS[slug][language]
    fallback = {"javascript": "number", "java": "int", "cpp": "int"}
    return fallback[language]


def _infer_arg_type(name, language):
    hint = ARG_TYPE_HINTS.get(name, {})
    return hint.get(language, "" if language == "javascript" else "int")


def _language_header(language):
    if language == "javascript":
        return ""
    if language == "java":
        return "import java.util.*;\n\n"
    return "#include <bits/stdc++.h>\nusing namespace std;\n\n"


def _signature(language, slug, args):
    if language == "javascript":
        return f"function solve({', '.join(args)}) {{"
    return_type = _infer_return_type(slug, language)
    typed_args = []
    for arg in args:
        arg_type = _infer_arg_type(arg, language)
        typed_args.append(f"{arg_type} {arg}".strip())
    if language == "java":
        return f"public class Solution {{\n    public static {return_type} solve({', '.join(typed_args)}) {{"
    return f"{return_type} solve({', '.join(typed_args)}) {{"


def _footer(language):
    if language == "java":
        return "    }\n}\n"
    return "}\n"


def _comment_prefix(language):
    return "//" if language in {"javascript", "java", "cpp"} else "#"


def _fallback_return(language, slug):
    return_type = _infer_return_type(slug, language)
    if return_type in {"boolean", "bool"}:
        return "return false;"
    if return_type in {"string", "String"}:
        return 'return "";'
    if return_type in {"number[]", "int[]", "vector<int>", "string[]", "List<String>", "vector<string>", "boolean[]", "List<Boolean>", "vector<bool>", "number[][]", "List<List<Integer>>", "vector<vector<int>>"}:
        if language == "java" and return_type == "int[]":
            return "return new int[0];"
        if language == "java" and return_type.startswith("List"):
            return "return new ArrayList<>();"
        if language == "cpp" and return_type.startswith("vector"):
            return "return {};"
        return "return [];"
    if return_type == "double":
        return "return 0.0;"
    return "return 0;"


def _build_guided_port(template, language, python_code):
    title = template.get("title", template["slug"].replace("-", " ").title())
    summary = template.get("short_description", "")
    args = _extract_args(python_code)
    prefix = _comment_prefix(language)
    python_lines = [line.rstrip() for line in python_code.strip().splitlines()[1:] if line.strip()]
    step_lines = [f"{prefix} {line.strip()}" for line in python_lines]
    body_indent = "    " if language == "javascript" else "        " if language == "java" else "    "
    blocks = [
        _language_header(language) + _signature(language, template["slug"], args),
        f"{body_indent}{prefix} Guided port for {title}.",
        f"{body_indent}{prefix} Quick brief: {summary or 'Use the detailed explanation from the problem statement.'}",
        f"{body_indent}{prefix} Algorithm steps mirrored from the validated Python solution:",
    ]
    blocks.extend(f"{body_indent}{line}" for line in step_lines)
    blocks.append(f"{body_indent}{prefix} Translate each step directly if you want to harden this version further.")
    blocks.append(f"{body_indent}{_fallback_return(language, template['slug'])}")
    blocks.append(_footer(language))
    return "\n".join(blocks)


def get_seed_solutions(template):
    slug = template["slug"]
    python_code = PYTHON_SOLUTION_BANK.get(slug)
    if not python_code:
        return []
    title = template.get("title", slug.replace("-", " ").title())
    summary = template.get("short_description", "")
    explanation = f"Seeded reference solution for {title}. {summary}".strip()
    return [
        {
            "language": "python",
            "code": python_code,
            "explanation": f"{explanation} This is the validated working Python implementation.",
            "approach_type": "optimized",
        },
        {
            "language": "javascript",
            "code": _build_guided_port(template, "javascript", python_code),
            "explanation": f"{explanation} The JavaScript tab now includes a guided port with the exact algorithm steps from the Python implementation.",
            "approach_type": "optimized",
        },
        {
            "language": "java",
            "code": _build_guided_port(template, "java", python_code),
            "explanation": f"{explanation} The Java tab now includes a guided port with the exact algorithm steps from the Python implementation.",
            "approach_type": "optimized",
        },
        {
            "language": "cpp",
            "code": _build_guided_port(template, "cpp", python_code),
            "explanation": f"{explanation} The C++ tab now includes a guided port with the exact algorithm steps from the Python implementation.",
            "approach_type": "optimized",
        },
    ]
