import assert from 'node:assert/strict';
import test from 'node:test';
import {isStoredImagePath} from '../storedImagePath.ts';

test('only known app-data image paths are accepted',()=>{
 for(const path of ['images/550e8400-e29b-41d4-a716-446655440000.png','covers/cover-01.webp','page-assets/thumb.jpg','thumbnails/page.jpeg'])assert.equal(isStoredImagePath(path),true,path);
 for(const path of ['../images/a.png','C:/users/a.png','file:///image.png','images/../../secret.png','images/a.svg','data:image/png;base64,AA==','notex.db'])assert.equal(isStoredImagePath(path),false,path);
});
