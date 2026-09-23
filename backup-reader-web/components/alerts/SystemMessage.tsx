import React, { FC } from "react";
import Image from 'next/image';
import styles from './SystemMessage.module.css';

interface SystemMessageProps {
    image: string;
    text: string;
    alt: string;
    width: number;
    height: number;
}

export const SystemMessage: FC<SystemMessageProps> = ({ image, text, width, height, alt }) => {

    return (
        <div className={`${styles.SystemMessageContainer}`}>
            <div className={styles.imageContainer}>
                <Image
                    priority
                    src={image}
                    width={ width ? width : 40}
                    height={ height ? height : 40}
                    alt={ alt ? alt : "" }
                />
            </div>
            <div className={styles.contentContainer}>
                <p>{text}</p>
            </div>
        </div>
    );
};
