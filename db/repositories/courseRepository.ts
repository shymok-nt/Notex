import * as Crypto from 'expo-crypto';
import {getDatabase,withSafeTransaction} from '@/db/database';
import type {Course,Topic,CourseDeleteMode} from '@/types/course';
type CourseRow={id:string;name:string;color:string;icon:string;sort_order:number;created_at:string};
type TopicRow={id:string;course_id:string;name:string;sort_order:number;created_at:string};
const asCourse=(r:CourseRow):Course=>({id:r.id,name:r.name,color:r.color,icon:r.icon,order:r.sort_order,createdAt:r.created_at});
const asTopic=(r:TopicRow):Topic=>({id:r.id,courseId:r.course_id,name:r.name,order:r.sort_order,createdAt:r.created_at});
const validName=(name:string)=>{const v=name.trim();if(!v||v.length>100)throw new Error('İsim 1-100 karakter olmalı.');return v};
const colorSafe=(color:string)=>/^#[0-9a-fA-F]{6}$/.test(color)?color:'#3347D9';
export const courseRepository={
 async all(){const db=await getDatabase();const [courses,topics]=await Promise.all([
  db.getAllAsync<CourseRow>('SELECT * FROM courses ORDER BY sort_order,id'),
  db.getAllAsync<TopicRow>('SELECT * FROM topics ORDER BY course_id,sort_order,id')
 ]);return {courses:courses.map(asCourse),topics:topics.map(asTopic)}},
 async addCourse(name:string,color='#3347D9',icon='book-open'){
  const db=await getDatabase(),id=Crypto.randomUUID(),createdAt=new Date().toISOString();
  await withSafeTransaction(db,async tx=>{
   const last=await tx.getFirstAsync<{n:number}>('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM courses');
   await tx.runAsync('INSERT INTO courses(id,name,color,icon,sort_order,created_at) VALUES(?,?,?,?,?,?)',id,validName(name),colorSafe(color),icon,last?.n??0,createdAt);
  });
  return {id,name:validName(name),color:colorSafe(color),icon,order:(await db.getFirstAsync<{sort_order:number}>('SELECT sort_order FROM courses WHERE id=?',id))!.sort_order,createdAt} as Course
 },
 async updateCourse(id:string,patch:Partial<Pick<Course,'name'|'color'|'icon'|'order'>>){
  const db=await getDatabase(),fields:string[]=[],values:(string|number)[]=[];
  if(patch.name!==undefined){fields.push('name=?');values.push(validName(patch.name))}
  if(patch.color!==undefined){fields.push('color=?');values.push(colorSafe(patch.color))}
  if(patch.icon!==undefined){fields.push('icon=?');values.push(patch.icon)}
  if(patch.order!==undefined){fields.push('sort_order=?');values.push(patch.order)}
  if(fields.length)await db.runAsync('UPDATE courses SET '+fields.join(',')+' WHERE id=?',...values,id);
 },
 async addTopic(courseId:string,name:string){
  const db=await getDatabase(),id=Crypto.randomUUID(),createdAt=new Date().toISOString();
  const order=await withSafeTransaction(db,async tx=>{
   const course=await tx.getFirstAsync<{id:string}>('SELECT id FROM courses WHERE id=?',courseId);
   if(!course)throw new Error('Ders bulunamadı');
   const last=await tx.getFirstAsync<{n:number}>('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM topics WHERE course_id=?',courseId);
   const position=last?.n??0;
   await tx.runAsync('INSERT INTO topics(id,course_id,name,sort_order,created_at) VALUES(?,?,?,?,?)',id,courseId,validName(name),position,createdAt);
   return position;
  });
  return {id,courseId,name:validName(name),order,createdAt} as Topic;
 },
 async renameTopic(id:string,name:string){const db=await getDatabase();await db.runAsync('UPDATE topics SET name=? WHERE id=?',validName(name),id)},
 async moveNotebook(notebookId:string,courseId:string|null,topicId:string|null){
  const db=await getDatabase();
  await withSafeTransaction(db,async tx=>{
   const notebook=await tx.getFirstAsync<{id:string}>('SELECT id FROM notebooks WHERE id=? AND deleted_at IS NULL',notebookId);
   if(!notebook)throw new Error('Not bulunamadı');
   if(topicId!==null){
    if(courseId===null)throw new Error('Konu için ders seçilmeli');
    const target=await tx.getFirstAsync<{id:string}>('SELECT id FROM topics WHERE id=? AND course_id=?',topicId,courseId);
    if(!target)throw new Error('Seçilen konu bu derse ait değil');
   }else if(courseId!==null){
    const course=await tx.getFirstAsync<{id:string}>('SELECT id FROM courses WHERE id=?',courseId);
    if(!course)throw new Error('Ders bulunamadı');
   }
   await tx.runAsync('UPDATE notebooks SET course_id=?,topic_id=?,updated_at=? WHERE id=?',courseId,topicId,new Date().toISOString(),notebookId);
  });
 },
 async deleteTopic(id:string,mode:CourseDeleteMode='unclassify'){
  const db=await getDatabase();
  await withSafeTransaction(db,async tx=>{
   const topic=await tx.getFirstAsync<{course_id:string}>('SELECT course_id FROM topics WHERE id=?',id);
   if(!topic)throw new Error('Konu bulunamadı');
   if(mode==='trash')await tx.runAsync('UPDATE notebooks SET deleted_at=? WHERE topic_id=? AND deleted_at IS NULL',new Date().toISOString(),id);
   await tx.runAsync('UPDATE notebooks SET course_id=NULL,topic_id=NULL WHERE topic_id=?',id);
   await tx.runAsync('DELETE FROM topics WHERE id=?',id);
  });
 },
 async deleteCourse(id:string,mode:CourseDeleteMode='unclassify'){
  const db=await getDatabase();
  await withSafeTransaction(db,async tx=>{
   const course=await tx.getFirstAsync<{id:string}>('SELECT id FROM courses WHERE id=?',id);
   if(!course)throw new Error('Ders bulunamadı');
   if(mode==='trash')await tx.runAsync('UPDATE notebooks SET deleted_at=? WHERE course_id=? AND deleted_at IS NULL',new Date().toISOString(),id);
   await tx.runAsync('UPDATE notebooks SET course_id=NULL,topic_id=NULL WHERE course_id=?',id);
   await tx.runAsync('DELETE FROM courses WHERE id=?',id);
  });
 }
};
