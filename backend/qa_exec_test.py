from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
import logging
from users_app.models import User, Course
from courses.models import ActivityType, QuizAttempt
import json

logger = logging.getLogger(__name__)
results = {}
suffix = timezone.now().strftime('%H%M%S')
instructor, _ = User.objects.get_or_create(username=f'qa_instructor_{suffix}', defaults={'role':'instructor','school_id':f'INS{suffix}'})
student, _ = User.objects.get_or_create(username=f'qa_student_{suffix}', defaults={'role':'student','school_id':f'STU{suffix}'})
instructor.role = 'instructor'; instructor.save(update_fields=['role'])
student.role = 'student'; student.save(update_fields=['role'])
course = Course.objects.create(instructor=instructor, title=f'QA Course {suffix}', description='qa')
course.students.add(student)
quiz_type, _ = ActivityType.objects.get_or_create(name='quiz', defaults={'weight':0,'requires_points':True,'requires_due_date':True})

client = APIClient()
client.defaults['HTTP_HOST'] = 'localhost'

sections = [{
  'id':1,
  'title':'Section 1',
  'instructions':'',
  'questions':[
    {'id':1,'question_text':'Q1','type':'multiple_choice','options':[{'id':1,'text':'A'},{'id':2,'text':'B'}],'correct_answer':'A','points':20},
    {'id':2,'question_text':'Q2','type':'true_false','correct_answer':'true','points':10},
    {'id':3,'question_text':'Q3','type':'identification','correct_answer':'x','points':20},
  ]
}]

client.force_authenticate(user=instructor)
payload = {
  'title':'QA Test Quiz', 'description':'qa', 'assessment_type':'quiz', 'publish_state':'draft',
  'course': course.id, 'activity_type': quiz_type.id,
  'anti_cheat_enabled': True, 'anti_cheat_tab_switch': True,
  'anti_cheat_disable_copy_paste': True, 'anti_cheat_fullscreen_required': True,
  'quiz_time_limit_seconds': 600, 'max_attempts': 2, 'sections': sections,
}
create_resp = client.post(f'/api/courses/{course.id}/exam-quizzes/', payload, format='json')
results['create_status'] = create_resp.status_code
results['create_body'] = getattr(create_resp, 'data', None)
activity_id = getattr(create_resp, 'data', {}).get('id') if hasattr(create_resp, 'data') else None
results['created_activity_id'] = activity_id

if activity_id:
    client.force_authenticate(user=student)
    draft_detail = client.get(f'/api/courses/{course.id}/activities/{activity_id}/quiz/')
    draft_start = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/start/', {}, format='json')
    results['draft_detail_status'] = draft_detail.status_code
    results['draft_start_status'] = draft_start.status_code

    client.force_authenticate(user=instructor)
    publish_resp = client.patch(f'/api/courses/{course.id}/exam-quizzes/{activity_id}/', {'publish_state':'published'}, format='json')
    results['publish_status'] = publish_resp.status_code

    client.force_authenticate(user=student)
    quiz_detail = client.get(f'/api/courses/{course.id}/activities/{activity_id}/quiz/')
    results['quiz_detail_status'] = quiz_detail.status_code
    if quiz_detail.status_code == 200:
        results['quiz_detail_total_points'] = quiz_detail.data.get('total_points')
        results['quiz_detail_publish_state'] = quiz_detail.data.get('publish_state')
        results['quiz_detail_anticheat'] = {k: quiz_detail.data.get(k) for k in ['anti_cheat_enabled','anti_cheat_tab_switch','anti_cheat_disable_copy_paste','anti_cheat_fullscreen_required']}

    start_resp = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/start/', {}, format='json')
    results['start_status'] = start_resp.status_code
    start_data = getattr(start_resp, 'data', {}) if hasattr(start_resp, 'data') else {}
    results['start_data'] = start_data
    attempt_id = start_data.get('attempt_id')

    if attempt_id:
        attempt = QuizAttempt.objects.get(id=attempt_id)
        results['attempt_snapshot_len'] = len(attempt.question_snapshot or [])
        results['attempt_total_points'] = float(attempt.total_points or 0)

        sec1 = client.post(f'/api/courses/{course.id}/exam-quizzes/{activity_id}/security-events/', {'event_type':'tab_switch','attempt_id':attempt_id,'details':{}}, format='json')
        sec2 = client.post(f'/api/courses/{course.id}/exam-quizzes/{activity_id}/security-events/', {'event_type':'fullscreen_exit','attempt_id':attempt_id,'details':{}}, format='json')
        sec3 = client.post(f'/api/courses/{course.id}/exam-quizzes/{activity_id}/security-events/', {'event_type':'copy_attempt','attempt_id':attempt_id,'details':{}}, format='json')
        results['security_statuses'] = [sec1.status_code, sec2.status_code, sec3.status_code]
        results['security_payloads'] = [getattr(sec1,'data',{}), getattr(sec2,'data',{}), getattr(sec3,'data',{})]

        attempt.refresh_from_db()
        results['attempt_suspicious_events'] = int(attempt.suspicious_events or 0)
        results['attempt_last_activity_at'] = str(attempt.last_activity_at)

        answers = [
          {'question_id':1,'answer':'A'},
          {'question_id':2,'answer':'True'},
          {'question_id':3,'answer':'x'},
        ]
        submit1 = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/submit/', {'attempt_id':attempt_id,'answers':answers}, format='json')
        submit2 = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/submit/', {'attempt_id':attempt_id,'answers':answers}, format='json')
        results['submit_statuses'] = [submit1.status_code, submit2.status_code]
        results['submit1_data'] = getattr(submit1,'data',{})
        results['submit2_data'] = getattr(submit2,'data',{})

        # snapshot integrity
        start2 = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/start/', {}, format='json')
        attempt2_id = getattr(start2,'data',{}).get('attempt_id') if hasattr(start2,'data') else None
        results['start2_status'] = start2.status_code
        results['attempt2_id'] = attempt2_id

        client.force_authenticate(user=instructor)
        current_detail = client.get(f'/api/courses/{course.id}/exam-quizzes/{activity_id}/')
        patch_sections = current_detail.data.get('sections', []) if hasattr(current_detail,'data') else []
        if patch_sections:
            patch_sections[0]['questions'][0]['points'] = 5
        patch_after = client.patch(f'/api/courses/{course.id}/exam-quizzes/{activity_id}/', {'sections':patch_sections}, format='json')
        results['patch_after_start_status'] = patch_after.status_code

        client.force_authenticate(user=student)
        if attempt2_id:
            submit_after_edit = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/submit/', {'attempt_id':attempt2_id,'answers':answers}, format='json')
            results['submit_after_edit_status'] = submit_after_edit.status_code
            results['submit_after_edit_data'] = getattr(submit_after_edit,'data',{})

        # timeout check
        start3 = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/start/', {}, format='json')
        attempt3_id = getattr(start3,'data',{}).get('attempt_id') if hasattr(start3,'data') else None
        if attempt3_id:
            at3 = QuizAttempt.objects.get(id=attempt3_id)
            at3.started_at = timezone.now() - timedelta(seconds=2000)
            at3.save(update_fields=['started_at'])
            timeout_submit = client.post(f'/api/courses/{course.id}/activities/{activity_id}/quiz/submit/', {'attempt_id':attempt3_id,'answers':answers}, format='json')
            results['timeout_submit_status'] = timeout_submit.status_code
            results['timeout_submit_data'] = getattr(timeout_submit,'data',{})

# zero-question quiz
client.force_authenticate(user=instructor)
zero_payload = {'title':'Zero Quiz','assessment_type':'quiz','publish_state':'published','course':course.id,'activity_type':quiz_type.id,'sections':[]}
zero_create = client.post(f'/api/courses/{course.id}/exam-quizzes/', zero_payload, format='json')
results['zero_quiz_create_status'] = zero_create.status_code
results['zero_quiz_create_data'] = getattr(zero_create,'data',{})
zero_id = getattr(zero_create,'data',{}).get('id') if hasattr(zero_create,'data') else None
if zero_id:
    client.force_authenticate(user=student)
    zero_start = client.post(f'/api/courses/{course.id}/activities/{zero_id}/quiz/start/', {}, format='json')
    results['zero_quiz_start_status'] = zero_start.status_code
    results['zero_quiz_start_data'] = getattr(zero_start,'data',{})

logger.info("QA execution test results", extra={"results": results})
