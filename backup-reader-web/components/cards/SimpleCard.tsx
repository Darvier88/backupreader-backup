import React, { FC } from "react";
import Image from 'next/image';
import styles from './SimpleCard.module.css';
import { Button } from "@nextui-org/react";
import { useRouter } from "next/router";

interface SimpleCardProps {
    image: string;
    title: string;
    text: string;
    ctaLabel: string;
    ctaRoute: string;
    background: boolean;
}

export const SimpleCard: FC<SimpleCardProps> = ({ image, title, text, ctaLabel, ctaRoute, background }) => {

    const router = useRouter();

    return (
        <div className={ background ? styles.simpleCardContainerBackground : styles.simpleCardContainer }>
            {
                image !== "" ? 
                    <Image
                        priority
                        src={image}
                        width={300}
                        height={300}
                        alt="Seguridad de datos"
                    /> : null
            }
                
                <h3>{title}</h3>
                <p>{text}</p>
                
                <Button
                    color={'primary'}
                    onPress={() => router.push(ctaRoute)}
                >
                    {ctaLabel}
                </Button>
        </div>
    );
};
