from courses.services.grading import compute_final_grade


def calculate_student_grade(student, course):
    return compute_final_grade(student, course)
