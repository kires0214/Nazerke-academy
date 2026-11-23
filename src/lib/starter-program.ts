import type { Content } from './content';

export function isStarterCourse(node: Pick<Content, 'kind' | 'slug' | 'data'>) {
  return node.kind === 'course' && (node.data.starter ?? (node.slug === 'kenwood'));
}

export function starterProgram(nodes: Content[], progress: {lesson_id:string;completed_at:string|null}[]) {
  const completed = new Set(progress.filter(item => item.completed_at).map(item => item.lesson_id));
  const lessonsByModule = new Map<string, Content[]>();
  for (const lesson of nodes) {
    if (lesson.kind !== 'lesson' || !lesson.parent_id) continue;
    const lessons = lessonsByModule.get(lesson.parent_id) ?? [];
    lessons.push(lesson);
    lessonsByModule.set(lesson.parent_id, lessons);
  }
  const lessonsByCourse = new Map<string, Content[]>();
  for (const module of nodes) {
    if (module.kind !== 'module' || !module.parent_id) continue;
    const lessons = lessonsByCourse.get(module.parent_id) ?? [];
    for (const lesson of lessonsByModule.get(module.id) ?? []) lessons.push(lesson);
    lessonsByCourse.set(module.parent_id, lessons);
  }
  const courses = nodes.filter(isStarterCourse).flatMap(course => {
    const lessons = lessonsByCourse.get(course.id);
    if (!lessons?.length) return [];
    return [{
      course,
      total: lessons.length,
      done: lessons.filter(lesson => completed.has(lesson.id)).length,
      nextLesson: lessons.find(lesson => !completed.has(lesson.id)),
    }];
  });
  const remaining = courses.find(course => course.nextLesson);
  return { courses, finished: courses.filter(course => !course.nextLesson).length, remaining };
}
