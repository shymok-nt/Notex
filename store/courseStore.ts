import {create} from 'zustand';
import {courseRepository} from '@/db/repositories/courseRepository';
import {settingsRepository} from '@/db/repositories/settingsRepository';
import {useNotebookStore} from '@/store/notebookStore';
import type {Course,Topic,CourseDeleteMode} from '@/types/course';

type State={
 courses:Course[];topics:Topic[];hydrated:boolean;
 selectedCourseId:string|null;selectedTopicId:string|null;
 expandedIds:string[];
 hydrate:()=>Promise<void>;refresh:()=>Promise<void>;
 select:(courseId:string|null,topicId?:string|null)=>void;
 toggleExpanded:(id:string)=>Promise<void>;
 addCourse:(name:string,color?:string,icon?:string)=>Promise<string>;
 updateCourse:(id:string,patch:Partial<Pick<Course,'name'|'color'|'icon'|'order'>>)=>Promise<void>;
 addTopic:(courseId:string,name:string)=>Promise<string>;
 renameTopic:(id:string,name:string)=>Promise<void>;
 removeCourse:(id:string,mode:CourseDeleteMode)=>Promise<void>;
 removeTopic:(id:string,mode:CourseDeleteMode)=>Promise<void>;
 moveNotebook:(id:string,courseId:string|null,topicId:string|null)=>Promise<void>;
};
export const useCourseStore=create<State>((set,get)=>({
 courses:[],topics:[],hydrated:false,selectedCourseId:null,selectedTopicId:null,expandedIds:[],
 hydrate:async()=>{
  const [data,expanded]=await Promise.all([courseRepository.all(),settingsRepository.get('courseTreeExpanded')]);
  let expandedIds:string[]=[];
  if(expanded!==null){try{const value:unknown=JSON.parse(expanded);if(Array.isArray(value))expandedIds=value.filter((item):item is string=>typeof item==='string')}catch{}}
  set({...data,expandedIds,hydrated:true});
 },
 refresh:async()=>{const data=await courseRepository.all();set(data)},
 select:(courseId,topicId=null)=>set({selectedCourseId:courseId,selectedTopicId:topicId}),
 toggleExpanded:async id=>{
  const expandedIds=get().expandedIds.includes(id)?get().expandedIds.filter(item=>item!==id):[...get().expandedIds,id];
  await settingsRepository.set('courseTreeExpanded',JSON.stringify(expandedIds));set({expandedIds});
 },
 addCourse:async(name,color,icon)=>{
  const course=await courseRepository.addCourse(name,color,icon);
  set(state=>({courses:[...state.courses,course]}));return course.id;
 },
 updateCourse:async(id,patch)=>{
  await courseRepository.updateCourse(id,patch);
  set(state=>({courses:state.courses.map(item=>item.id===id?{...item,...patch}:item)}));
 },
 addTopic:async(courseId,name)=>{
  const topic=await courseRepository.addTopic(courseId,name);
  set(state=>({topics:[...state.topics,topic]}));return topic.id;
 },
 renameTopic:async(id,name)=>{
  await courseRepository.renameTopic(id,name);
  set(state=>({topics:state.topics.map(item=>item.id===id?{...item,name:name.trim()}:item)}));
 },
 removeCourse:async(id,mode)=>{
  await courseRepository.deleteCourse(id,mode);
  set(state=>({courses:state.courses.filter(item=>item.id!==id),topics:state.topics.filter(item=>item.courseId!==id),selectedCourseId:state.selectedCourseId===id?null:state.selectedCourseId,selectedTopicId:state.selectedCourseId===id?null:state.selectedTopicId}));
  await useNotebookStore.getState().refresh();
 },
 removeTopic:async(id,mode)=>{
  await courseRepository.deleteTopic(id,mode);
  set(state=>({topics:state.topics.filter(item=>item.id!==id),selectedTopicId:state.selectedTopicId===id?null:state.selectedTopicId}));
  await useNotebookStore.getState().refresh();
 },
 moveNotebook:async(id,courseId,topicId)=>{
  await courseRepository.moveNotebook(id,courseId,topicId);
  // Only update the changed record; no notebook list fetch.
  useNotebookStore.setState(state=>({notebooks:state.notebooks.map(item=>item.id===id?{...item,courseId,topicId}:item)}));
 }
}));
