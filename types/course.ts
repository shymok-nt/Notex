export type Course={id:string;name:string;color:string;icon:string;order:number;createdAt:string};
export type Topic={id:string;courseId:string;name:string;order:number;createdAt:string};
export type CourseDeleteMode='unclassify'|'trash';
