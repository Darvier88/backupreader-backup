import {useRouter} from 'next/router';
import Link from 'next/link';

function List(){
    return (<>
        <h1>All backups from luis</h1>
        <Link href="/">My Backup</Link>
    </>)
}

export default List;